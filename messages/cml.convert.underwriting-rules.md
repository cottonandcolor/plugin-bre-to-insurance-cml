# summary

Converts BRE-based Insurance Underwriting dynamic rules to CML eligibility constraints.

# description

Reads UnderwritingRule records from the org (or a JSON file), parses their DynamicRuleDefinition, and generates CML constraints that evaluate underwriting eligibility. Each rule becomes a named constraint that returns true/false.

The command outputs:

- A .cml file with the constraint model
- An \_Associations.csv file for ExpressionSetConstraintObj records
- A \_RuleKeyMapping.json with the UnderwritingRule ID to RuleKey mapping for updating records

# examples

- <%= config.bin %> <%= command.id %> --cml-api UW_CML --target-org myOrg
- <%= config.bin %> <%= command.id %> --cml-api UW_CML --uw-file data/underwriting.json --workspace-dir data --target-org myOrg

# flags.cml-api.summary

Unique CML API Name to be created.

# flags.workspace-dir.summary

Directory where output files will be written.

# flags.uw-file.summary

Optional JSON file with pre-exported UnderwritingRule records. If omitted, records are queried from the org.
