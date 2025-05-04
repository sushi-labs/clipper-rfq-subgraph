import fs from 'fs'
import path from 'path'
import YAML from 'json-to-pretty-yaml'
import { isAddress } from 'viem'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Deployment } from './deploy-codegen/config'
import { getMaticDeploymentConfig } from './deploy-codegen/networks/matic'
import { getOptimismDeploymentConfig } from './deploy-codegen/networks/optimism'
import { getMoonbeamDeploymentConfig } from './deploy-codegen/networks/moonbeam'
import { getMainnetDeploymentConfig } from './deploy-codegen/networks/mainnet'
import { getArbitrumDeploymentConfig } from './deploy-codegen/networks/arbitrum'
import { getBaseDeploymentConfig } from './deploy-codegen/networks/base'
import { getMantleDeploymentConfig } from './deploy-codegen/networks/mantle'
import { getPolygonZkevmDeploymentConfig } from './deploy-codegen/networks/polygon-zkevm'
import { validateUniqueAddresses, validatePoolTokenPrices } from './deploy-codegen/validation'
import { loadOrFetchDailyPrices, mapPricesToAddresses, AddressKeyedDailyPrices } from './deploy-codegen/prices'
import { SubgraphManifest, transformDeploymentToManifestBase, generateSubgraphManifest } from './deploy-codegen/manifest'

// Helper function to get the deployment for a source
const getDeploymentForSource = (source: string): Deployment => {
  let deploymentPartial: ReturnType<typeof getMaticDeploymentConfig>;

  switch (source) {
    case 'matic': deploymentPartial = getMaticDeploymentConfig(); break;
    case 'optimism': deploymentPartial = getOptimismDeploymentConfig(); break;
    case 'moonbeam': deploymentPartial = getMoonbeamDeploymentConfig(); break;
    case 'ethereum': deploymentPartial = getMainnetDeploymentConfig(); break;
    case 'arbitrum': deploymentPartial = getArbitrumDeploymentConfig(); break;
    case 'base': deploymentPartial = getBaseDeploymentConfig(); break;
    case 'mantle': deploymentPartial = getMantleDeploymentConfig(); break;
    case 'polygon-zkevm': deploymentPartial = getPolygonZkevmDeploymentConfig(); break;
    default: throw new Error(`Unsupported deployment source: ${source}`);
  }

  const abiNames = new Set<string>();
  deploymentPartial.pools.forEach(p => { abiNames.add(p.contractAbiName); abiNames.add(p.sourceAbi); });
  deploymentPartial.coves.forEach(c => { abiNames.add(c.contractAbiName); abiNames.add(c.sourceAbi); });
  deploymentPartial.priceOracles.forEach(o => { abiNames.add(o.contractAbiName); abiNames.add(o.sourceAbi); });
  abiNames.add('ERC20');

  const deployment: Deployment = deploymentPartial

  validateUniqueAddresses(deployment.pools.map(p => p.address), 'pool');
  validateUniqueAddresses(deployment.coves.map(c => c.address), 'cove');
  validateUniqueAddresses(deployment.priceOracles.map(o => o.address), 'price oracle');
  const allOracleTokens = deployment.priceOracles.flatMap(o => o.tokens);
  validateUniqueAddresses(allOracleTokens, 'price oracle token');

  return deployment;
};

yargs(hideBin(process.argv))
  .command(
    'template',
    'Generate subgraph manifest and address files.',
    yargs => {
      return yargs
        .option('deployment', {
          type: 'string',
          default: 'matic',
          description: 'The deployment to update',
        })
        .option('fallback-prices-start-date', {
          type: 'string',
          description: 'Start date (YYYY-MM-DD) for fallback prices',
        })
        .option('fallback-prices-end-date', {
          type: 'string',
          description: 'End date (YYYY-MM-DD) for fallback prices',
        })
        .option('fallback-prices-tokens', {
          type: 'array',
          description: 'Token symbols for fallback prices',
        })
        .option('fallback-prices-output', {
          type: 'string',
          default: './prices.json',
          description: 'Path for raw fallback price data',
        })
        .option('skip-validation', {
          type: 'boolean',
          default: false,
          description: 'Skip token price validation',
        })
    },
    async args => {
      let deployment = getDeploymentForSource(args.deployment)
      let symbolToAddressMap: Map<string, string[]> = new Map();
      let addressKeyedDailyPrices: AddressKeyedDailyPrices | undefined = undefined;

      if (args['fallback-prices-start-date'] && args['fallback-prices-end-date']) {
        const startDate = args['fallback-prices-start-date'] as string
        const endDate = args['fallback-prices-end-date'] as string
        const tokens = (args['fallback-prices-tokens'] as string[]) || [];
        const outputPath = args['fallback-prices-output'] as string
        try {
          const fetchedDailyPricesData = await loadOrFetchDailyPrices(tokens, startDate, endDate, outputPath);
          if (!args['skip-validation']) {
            console.log('Validating deployment configuration...')
            const { deployment: validatedDeployment, symbolToAddresses } = await validatePoolTokenPrices(deployment);
            deployment = validatedDeployment;
            symbolToAddressMap = symbolToAddresses;
          } else {
            console.log('Skipping token price validation.')
            const { symbolToAddresses } = await validatePoolTokenPrices(deployment).catch(() => ({ symbolToAddresses: new Map<string, string[]>() }));
            symbolToAddressMap = symbolToAddresses;
          }
          addressKeyedDailyPrices = mapPricesToAddresses(fetchedDailyPricesData, symbolToAddressMap, tokens);
        } catch (error) {
          console.error('Error processing fallback prices:', error)
          process.exit(1)
        }
      } else {
        if (!args['skip-validation']) {
          const { deployment: validatedDeployment } = await validatePoolTokenPrices(deployment)
          deployment = validatedDeployment
        } else {
          console.log('Skipping token price validation.')
        }
      }

      // --- Prepare Data for Generation --- 
      // Create the object needed for Handlebars (if addresses.ts.hbs still uses it)
      const manifestBase = transformDeploymentToManifestBase({
          ...deployment,
          ...(addressKeyedDailyPrices && { dailyFallbackPrices: addressKeyedDailyPrices }), // Add prices if available
      })

      // --- Generate Manifest --- 
      console.log('Generating subgraph manifest object...');
      const manifestObject: SubgraphManifest = generateSubgraphManifest(manifestBase); // Use original deployment
      const manifestYaml = YAML.stringify(manifestObject);
      const manifestOutputPath = path.join(__dirname, '../subgraph.yaml');
      fs.writeFileSync(manifestOutputPath, manifestYaml);
      console.log(`Subgraph manifest written to ${manifestOutputPath}`);

      // --- Generate Static Address Map (Using Handlebars) ---
      {
          console.log('Generating static address map')
          const templateFile = path.join(__dirname, '../templates/addresses.ts.hbs')
          const outputFile = path.join(__dirname, '../src/addresses.ts')

          if (!fs.existsSync(templateFile)) {
              console.warn(`Address template file not found at ${templateFile}, skipping generation.`);
          } else {
              const templateContent = fs.readFileSync(templateFile, 'utf8')
              const handlebars = require('handlebars');
              handlebars.registerHelper('ifAddress', function(possibleAddress: string, options: any) {
                  if (isAddress(possibleAddress)) { return options.fn(this); }
                  else { return options.inverse(this); }
              });
              const compile = handlebars.compile(templateContent)
              // Use the specifically prepared handlebarsData
              const replaced = compile(manifestBase) 
              fs.writeFileSync(outputFile, replaced)
              console.log(`Static addresses written to ${outputFile}`);
          }
      }
    },
  )
  .help().argv
