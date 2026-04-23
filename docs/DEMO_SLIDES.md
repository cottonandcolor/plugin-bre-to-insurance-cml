# Insurance BRE to CML Migration Tool
## Demo Presentation

---

## Slide 1: Problem Statement

### Why Migrate from BRE to CML?

- **BRE (Business Rule Engine)** — legacy rule evaluation for surcharges and underwriting
- **CML (Constraint Model Language)** — next-gen constraint engine, better performance, unified model
- **264 GA Goal** — migrate existing BRE rules to CML for Insurance Surcharges and Underwriting Rules
- **Manual migration is error-prone** — each rule has complex JSON with nested criteria, attributes, operators
- **Need:** automated tool that reads BRE rules, generates valid CML, and updates records

---

## Slide 2: What the Tool Does

### One Command, Full Migration

```
sf cml convert surcharge-rules \
  --cml-api SURCHARGE_CML \
  --merge-from-org \
  --auto-update \
  --target-org myOrg
```

1. **Reads** BRE rules from ProductSurcharge / UnderwritingRule records
2. **Converts** ruleCriteria → CML `rule()` statements
3. **Fetches** existing CML from org and **merges** (preserves clause/configurator constraints)
4. **Outputs** one `.cml` file per root product
5. **Updates** records with RuleEngineType=ConstraintEngine and RuleKey

---

## Slide 3: Architecture

### BRE Rule (Input)

```json
{
  "ruleApiName": "BRE_Tax_AutoSilver_WA",
  "ruleCriteria": [{
    "sourceContextTagName": "Product",
    "sourceValues": ["01txx0000006i3DAAQ"],
    "conditions": [{
      "type": "Attribute",
      "attributeName": "Colour",
      "operator": "Equals",
      "values": ["Red"]
    }]
  }]
}
```

### CML Rule (Output)

```
rule(product.id == "01txx0000006i3DAAQ" && Colour == "Red",
    "InsuranceSurchargeRule",
    "SC__autoSilver__BRE_Tax_AutoSilver_WA",
    "True");
```

---

## Slide 4: Merge with Existing CML

### Before (existing clauses only)

```
type AutoSilver {
    relation auto : Auto;
}
type Auto : AutoClass {
    constraint(Year > 2020, "year must be greater than 2020");
}
```

### After (clauses + surcharges merged)

```
type AutoSilver {
    relation auto : Auto;
}
type Auto : AutoClass {
    constraint(Year > 2020, "year must be greater than 2020");
}
type LineItem {
    string Colour;
    rule(product.id == "..." && Colour == "Red",
        "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Tax_AutoSilver_WA", "True");
}
```

---

## Slide 5: Condition Types Supported

| BRE Condition | CML Output | Example |
|---------------|------------|---------|
| Product Attribute | `attributeName op value` | `Colour == "Red"` |
| Context Tag | `contextTagName op value` | `UserProfile != "Admin"` |
| Picklist | String comparison | `Deductible == "$100"` |
| Numeric comparison | `attr > value` | `Year > 2020` |
| In (multi-value) | OR expansion | `(x == "a" \|\| x == "b")` |
| Contains | `strcontain()` | `strcontain(Make, "Tesla")` |
| Product-only | Product ID check | `product.id == "01t..."` |
| Multi-criteria | AND/OR join | `(crit1) && (crit2)` |

---

## Slide 6: Per-Product Output

### One CML file per root product (matches org ExpressionSet model)

```
output/
├── autoSilver.cml                    ← AutoSilver product
├── autoSilver_Associations.csv
├── autoSilver_RuleKeyMapping.json
├── comprehensiveHealthPlan.cml       ← Family Health product
├── comprehensiveHealthPlan_Associations.csv
└── comprehensiveHealthPlan_RuleKeyMapping.json
```

### RuleKey format matches Core conventions

| Rule Type | Key Format | Example |
|-----------|------------|---------|
| Surcharge | `SC__{productCode}__{apiName}` | `SC__autoSilver__WA_Tax` |
| Underwriting | `UW__{productCode}__{stageName}__{apiName}` | `UW__autoSilver__DraftToApproved__RiskCheck` |
| Clause | `EX__{productCode}__{clauseCode}` | `EX__autoSilver__FreeLookPeriod` |

---

## Slide 7: Live Demo — Surcharge Migration

### Step 1: Run conversion

```
sf cml convert surcharge-rules \
  --cml-api SURCHARGE_CML \
  --merge-from-org --auto-update \
  --workspace-dir output --target-org preetiorg
```

### Step 2: Output

```
Grouped into 1 product(s):

--- autoSilver (4 rules) ---
  Found existing CML — merging
  -> BRE_Tax_AutoSilver_WA       => SC__autoSilver__BRE_Tax_AutoSilver_WA
  -> BRE_Tax_Auto_EV             => SC__autoSilver__BRE_Tax_Auto_EV
  -> BRE_Fee_AutoSilver_Processing => SC__autoSilver__BRE_Fee_AutoSilver_Processing
  -> BRE_Fee_AutoSilver_AdminFee => SC__autoSilver__BRE_Fee_AutoSilver_AdminFee

Converted 4 rules across 1 product(s)
Updated 4/4 ProductSurcharge records
```

### Step 3: Generated CML

```
type LineItem {
    string Colour;
    int Year;
    string UserProfile;

    rule(Colour == "Red", "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Tax_AutoSilver_WA", "True");
    rule(Year > 2020, "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Fee_AutoSilver_Processing", "True");
    rule(UserProfile != "System Administrator", "InsuranceSurchargeRule",
        "SC__autoSilver__BRE_Fee_AutoSilver_AdminFee", "True");
}
```

---

## Slide 8: Live Demo — Underwriting Migration

### Run conversion

```
sf cml convert underwriting-rules \
  --cml-api UW_CML \
  --merge-from-org --auto-update \
  --workspace-dir output --target-org preetiorg
```

### Updates both:
- **UnderwritingRule** — RuleKey (via mapping file / Connect API)
- **UnderwritingRuleGroup** — RuleEngineType = ConstraintEngine

---

## Slide 9: How It Works at Runtime

### CML Constraint Engine Flow

```
1. Quote/Policy action triggers CML rule evaluation
2. constraintsNearCoreGatewayAdapter.executeConstraints()
   → runs ALL active constraint models
3. Returns CustomRule results with details map:
   { "SC__autoSilver__WA_Tax": ["True"], ... }
4. parseRuleResults() filters by prefix:
   - "SC__" → surcharge rules
   - "UW__" → underwriting rules
   - "EX__" → clause exclusion rules
5. Matched rules drive surcharge calculation / underwriting decisions
```

---

## Slide 10: Migration Checklist

| Step | Command / Action |
|------|-----------------|
| 1. Convert rules | `sf cml convert surcharge-rules --merge-from-org --auto-update` |
| 2. Review CML files | `cat output/{productCode}.cml` |
| 3. Import to org | `sf cml import as-expression-set --cml-api {productCode} --context-definition <CD> --target-org <org>` |
| 4. Verify records | Check RuleEngineType=ConstraintEngine, RuleKey populated |
| 5. Test end-to-end | Create quote → calculate surcharges → verify results |
| 6. Repeat for UW | `sf cml convert underwriting-rules --merge-from-org --auto-update` |

---

## Slide 11: Key Design Decisions

| Decision | Why |
|----------|-----|
| `rule()` not `constraint()` | Matches existing Insurance CML pattern, returns key/value results for `parseRuleResults()` |
| `SC__` prefix on constraint names | Runtime filter `key.startsWith("SC__")` in `InsuranceCMLRuleExecutionServiceImpl` |
| One file per root product | Matches org model: one ExpressionSet per root product |
| `--merge-from-org` | Products may already have clause/configurator CML — must preserve |
| ProductPath for product code | `rootObjectId` in ruleCriteria may contain sandbox IDs |

---

## Slide 12: Source & Links

- **Tool repo:** https://github.com/cottonandcolor/plugin-bre-to-insurance-cml
- **User guide:** https://github.com/cottonandcolor/plugin-bre-to-insurance-cml/blob/main/docs/USER_GUIDE.md
- **Original plugin:** https://github.com/salesforcecli/plugin-bre-to-cml (PR #114)
- **W-21817142** — CML for Surcharges architecture
- **W-21983294** — BRE to CML Migration spike
- **W-22084877** — Server Side changes for Surcharge calculation using CML
