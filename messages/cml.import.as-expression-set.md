# summary

Imports CML and associations to the target org

# description

Review CM created by conversion command before doing import.  
This command executes following logic:
- Import one CML at a time
- Upsert the Expression Set using the `cml-api` name
- Read and upsert `ExpressionSetConstraintObj` rows from the `cml-api_associations.csv` file (resolving FKs)
- Upload the CML blob

# examples

- <%= config.bin %> <%= command.id %> --cml-api MY_TEST --context-definition PricingTransactionCD2 --workspace-dir data --target-org tgtOrg

# flags.context-definition.summary

Context Definition name to be assocciated with the CML.

# flags.cml-api.summary

Unique CML API Name to be created.

# flags.workspace-dir.summary

Directory where converted CML and assocciations csv files are located.

# flags.target-org.summary

Alias of the destination target org.
