# Insurance BRE to CML Migration Tool - User Guide

## Overview

CLI tool to migrate Insurance BRE (Business Rule Engine) dynamic rules to CML (Constraint Model Language) for ProductSurcharge and UnderwritingRule records.

**Source Code:** https://github.com/cottonandcolor/plugin-bre-to-insurance-cml

## Installation

```bash
cd /tmp/plugin-bre-to-insurance-cml
npm install
npx tsc
sf plugins link .
```

## Commands

### 1. Surcharge Rules Migration

```bash
sf cml convert surcharge-rules \
  --cml-api SURCHARGE_CML \
  --merge-from-org \
  --auto-update \
  --workspace-dir output \
  --target-org myOrg
```

### 2. Underwriting Rules Migration

```bash
sf cml convert underwriting-rules \
  --cml-api UW_CML \
  --merge-from-org \
  --auto-update \
  --workspace-dir output \
  --target-org myOrg
```

## Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--cml-api` | `-c` | Required. API name for the CML model |
| `--target-org` | `-o` | Required. Org alias or username |
| `--workspace-dir` | `-d` | Output directory (default: current dir) |
| `--surcharge-ids` / `--uw-ids` | `-s` | Comma-separated record IDs to convert (optional, converts all if omitted) |
| `--surcharge-file` / `--uw-file` | `-f` | Local JSON file with pre-exported records (skips org query) |
| `--merge-from-org` | | Fetch existing CML from org per product and merge new rules into it |
| `--auto-update` | `-u` | Update records in org (RuleEngineType + RuleKey for surcharges, RuleEngineType on UnderwritingRuleGroup for underwriting) |

## What It Does

1. **Queries** ProductSurcharge or UnderwritingRule records with BRE rules from the org
2. **Groups** by root product ID (from ProductPath) — one CML file per product
3. **Converts** BRE `ruleCriteria` conditions into CML `rule()` statements
4. **Merges** with existing CML from org (if `--merge-from-org`) — preserves existing constraints
5. **Outputs** per-product files: `.cml`, `_Associations.csv`, `_RuleKeyMapping.json`
6. **Updates** records in org (if `--auto-update`)

## Output Files

Per root product, three files are generated:

| File | Contents |
|------|----------|
| `{productCode}.cml` | CML constraint model with rule() statements |
| `{productCode}_Associations.csv` | ExpressionSetConstraintObj records for import |
| `{productCode}_RuleKeyMapping.json` | Record ID → RuleKey mapping with metadata |

## Sample BRE Rule Input (RuleDefinition JSON)

```json
{
  "ruleApiName": "BRE_Tax_AutoSilver_WA",
  "criteriaExpressionType": "ALL",
  "ruleCriteria": [
    {
      "rootObjectId": "01txx0000006i3DAAQ",
      "criteriaIndex": 1,
      "sourceContextTagName": "Product",
      "sourceOperator": "Equals",
      "sourceDataType": "String",
      "sourceValues": ["01txx0000006i3DAAQ"],
      "conditions": [
        {
          "contextTagName": "SalesTransactionItemAttribute",
          "operator": "Equals",
          "conditionIndex": 1,
          "attributeName": "Colour",
          "type": "Attribute",
          "attributeId": "0tjSB0000004QcmYAE",
          "attributePicklistValueId": null,
          "dataType": "String",
          "values": ["Red"]
        }
      ]
    }
  ]
}
```

## Sample CML Output

```
type AutoSilver;

type AutoClass {
    int Year;
}

type Auto;

type LineItem {
    string product_id;
    string Colour;
    int Year;
    string UserProfile;

    rule(product.id == "01txx0000006i3DAAQ" && Colour == "Red",
        "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Tax_AutoSilver_WA",
        "True");

    rule(product.id == "01txx0000006i3GAAQ",
        "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Tax_Auto_EV",
        "True");

    rule(product.id == "01txx0000006i3DAAQ" && Year > 2020,
        "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Fee_AutoSilver_Processing",
        "True");

    rule(product.id == "01txx0000006i3DAAQ" && UserProfile != "System Administrator",
        "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Fee_AutoSilver_AdminFee",
        "True");
}
```

## Sample RuleKeyMapping Output

```json
[
  {
    "recordId": "1Xrxx00000000jBCAQ",
    "name": "BRE_Tax_AutoSilver_WA",
    "ruleKey": "SC__autoSilver__BRE_Tax_AutoSilver_WA",
    "metadata": {
      "sequenceNumber": null,
      "effectiveFromDate": "2025-01-01",
      "effectiveToDate": null,
      "isProrationAllowed": true,
      "isRefundAllowed": false,
      "isActive": true,
      "ruleEngineType": "BusinessRuleEngine",
      "productPath": "01txx0000006i3DAAQ"
    }
  }
]
```

## CML Rule Format

The tool generates `rule()` statements matching the existing Insurance CML pattern:

```
rule(<condition>, "<actionName>", "<ruleKey>", "True");
```

| Rule Type | Action Name | Key Prefix |
|-----------|-------------|------------|
| Surcharge | `InsuranceSurchargeRule` | `SC__` |
| Underwriting | `InsuranceUnderwritingRule` | `UW__` |
| Clause Exclusion | `InsuranceClauseExclusionRule` | `EX__` |

**RuleKey format:** `{prefix}__{productCode}__{ruleApiName}`

## Condition Types Supported

| BRE Condition | CML Output |
|---------------|------------|
| Product attribute (`type: "Attribute"`) | Uses `attributeName` (e.g., `Colour == "Red"`) |
| Context tag (`type: "Tag"`) | Uses `contextTagName` (e.g., `UserProfile != "Admin"`) |
| Picklist attribute | Maps to string comparison |
| `Equals` / `NotEquals` | `==` / `!=` |
| `LessThan` / `GreaterThan` | `<` / `>` |
| `LessThanOrEquals` / `GreaterThanOrEquals` | `<=` / `>=` |
| `In` (multi-value) | `(x == "a" \|\| x == "b")` |
| `NotIn` | `!(x == "a" \|\| x == "b")` |
| `Contains` | `strcontain(attr, "value")` |
| `DoesNotContain` | `!strcontain(attr, "value")` |

## Merge Behavior

When `--merge-from-org` is used, the tool:

1. Looks up `ExpressionSetConstraintObj` for the root product ID
2. Gets the latest `ExpressionSetVersion`
3. Downloads `ExpressionSetDefinitionVersion.ConstraintModel` (the CML blob)
4. Parses existing CML and merges new rule() statements into it
5. Preserves all existing types, attributes, constraints, and relations

## Post-Migration Steps

1. Review the generated `.cml` files
2. Import into org: `sf cml import as-expression-set --cml-api {productCode} --context-definition <CD_NAME> --target-org <org>`
3. For underwriting rules, update `RuleKey` on `UnderwritingRule` records via Connect API (read-only via direct API)
4. Verify rules execute correctly by running a quote/policy flow

## Related Work Items

- W-21817142 — CML for Surcharges architecture
- W-21983294 — BRE to CML Migration spike
- W-22084876 — Tax & Fee CML UX Updates
- W-22084877 — Server Side changes for Surcharge calculation using CML
