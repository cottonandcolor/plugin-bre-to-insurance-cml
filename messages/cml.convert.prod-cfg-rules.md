# summary

Converts BRE based Standard Configurator rules represented as JSON to CML and saves it as a pair of CML and association files.

# description

Before you execute this command make sure to migrate you PCM or perform migration of rules within the same org.

Export BRE based Standard Configurator rules using sf data export bulk plugin and save results in a JSON file:
sf data export bulk -o breMigOrg --query "SELECT ApiName, ConfigurationRuleDefinition,Description, EffectiveFromDate, EffectiveToDate, Id, IsDeleted, Name, ProcessScope, RuleSubType, RuleType, Sequence, Status FROM ProductConfigurationRule WHERE RuleType = 'Configurator' AND ApiName = 'myTestBundle'" --output-file ./data/ProductConfigurationRules.json --result-format json --wait 10 --all-rows

This command executes following logic:

- Read SC Rules from the json file and build a list of `ConfiguratorRuleInput` to mimic the JSON structure of `ConfigurationRuleDefinition`
- Group rules by non-intersecting `Product2` IDs (CMLs can’t share products)
- For each group:
  - Query PCM for related products (for bundle rules) or root definitions (for others)
  - Build an in-memory representation of the CML
  - Apply logic to build constraints
- Serialize the in-memory CML to a blob for import as an Expression Set, save it in a cml-api.cml file. 
- Create `ExpressionSetConstraintObj` association records pointing to the `cml-api` name and write them to `cml-api_associations.csv` file.
- If multiple CML and association files are produced 1-N number will be appended to the names of files.

# flags.name.summary

Description of a flag.

# flags.name.description

More information about a flag. Don't repeat the summary.

# examples

- <%= config.bin %> <%= command.id %> --pcr-file data/ProductConfigurationRules.json --cml-api MY_TEST --workspace-dir data --target-org breMigOrg


# flags.pcr-file.summary

Name of the JSON file that contain exported standard Product Configuration Rules.

# flags.cml-api.summary

Unique CML API Name to be created.

# flags.workspace-dir.summary

Directory where working files are located, exported rules JSON and where CMLs will be created.

# flags.target-org.summary

Alias of the source target org.

# flags.additional-products.summary

Comma-separated list of additional product IDs for which CML types should be generated.

# flags.products-file.summary

Name of the JSON file that contain exported Products from PCM (if not present products will be fetched automatically).
