# summary

Converts BRE-based Product Surcharge dynamic rules to CML eligibility constraints.

# description

Reads ProductSurcharge records from the org (or a JSON file), parses their RuleDefinition, and generates CML constraints that evaluate surcharge eligibility. Each surcharge rule becomes a named constraint that returns true/false.

The command outputs:

- A .cml file with the constraint model
- An \_Associations.csv file for ExpressionSetConstraintObj records
- A \_RuleKeyMapping.json with the ProductSurcharge ID to RuleKey mapping for updating records

# examples

- <%= config.bin %> <%= command.id %> --cml-api SURCHARGE_CML --target-org myOrg
- <%= config.bin %> <%= command.id %> --cml-api SURCHARGE_CML --surcharge-file data/surcharges.json --workspace-dir data --target-org myOrg

# flags.cml-api.summary

Unique CML API Name to be created.

# flags.workspace-dir.summary

Directory where output files will be written.

# flags.surcharge-file.summary

Optional JSON file with pre-exported ProductSurcharge records. If omitted, records are queried from the org.
