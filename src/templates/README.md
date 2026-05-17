# Templates

## Description

This folder contains [ROBOT template](http://robot.obolibrary.org/template.html) TSV files used to generate the ontology [components](../ontology/components/README.md) for the Genomic Epidemiology Ontology (GenEpiO). Each TSV file corresponds to a tab (worksheet) from the [GENEPIO_ROBOT Tables](https://docs.google.com/spreadsheets/d/1Ieo0jokfXBbWIQv32g5D5s7x8FIeh7f-gGX6qI6AhN0/) curation workbook, exported for use in the ODK build pipeline.

Templates are the primary mechanism for curating new terms, deprecating old ones, defining specification fields and enumerations, and managing SSSOM cross-ontology mappings. During the build process, ROBOT reads these TSV files and produces the corresponding OWL/OFN component files in `src/ontology/components/`.

For a comprehensive legend of all ROBOT template headers and commands used across GENEPIO, refer to the **LEGEND** tab of the [GENEPIO_ROBOT Tables](https://docs.google.com/spreadsheets/d/1Ieo0jokfXBbWIQv32g5D5s7x8FIeh7f-gGX6qI6AhN0/) workbook.

## Directory Contents

### Temporary term templates (`robot_temp_*`)

Temporary (temp) GENEPIO terms pending adoption in a domain ontology. Once a term is accepted, import the replacement and move the GENEPIO entry to the deprecation template. Refer to the [GENEPIO wiki](https://github.com/GenEpiO/genepio/wiki/) for protocols and references.

| Element | Description | Target Component | Source Tab Name |
|---|---|---|---|
| `robot_temp_obi.tsv` | Temporary GENEPIO terms pending adoption in the [Ontology for Biomedical Investigations (OBI)](http://obi-ontology.org/). | `planned_obsolescence.ofn` | `temp_obi` |
| `robot_temp_envo.tsv` | Temporary GENEPIO terms pending adoption in the [Environment Ontology (ENVO)](http://www.environmentontology.org/). Same lifecycle as above. | `planned_obsolescence.ofn`] | `temp_envo` |
| `robot_temp_general.tsv` | Temporary GENEPIO terms pending adoption in other ontologies not covered by domain-specific temp templates. | `planned_obsolescence.ofn` | `temp_mint` |

### Specification templates (`robot_spec_*`)

GENEPIO term templates for organizing and streamlining data specifications. It is anticipated that several will eventually be merged into GENEPIO and/or managed as individual branches instead.

| Element | Description | Target Component | Source Tab Name |
|---|---|---|---|
| `robot_spec.tsv` | Specification class hierarchy top-level data specifications. | `specification.owl` | `spec` |
| `robot_spec_field.tsv` | Data fields that belong to one or more specifications; the majority are not data field entities. | `specification.owl` | `spec_field` |
| `robot_spec_enum.tsv` | Specification enumerations (i.e., permissible value sets / picklists) for specification fields, defined via `mentions` axioms. | `specification.owl` | `spec_enum` |
| `robot_spec_merge.tsv` | Specification picklist template for combining or reconciling specification-related classes during the build. Intended to be merged periodically or permanently. | `specification.owl` | `spec_merge` [TBD] |
| `robot_spec_annotations.tsv` | User Interface-level annotations applied to specification classes. | `specification.owl` | `spec_annotations` |

### SSSOM mapping templates (`robot_sssom_*`)

Templates for managing [SSSOM](https://mapping-commons.github.io/sssom/) cross-ontology and cross-database term mappings.

| Element | Description | Target Component | Source Tab Name |
|---|---|---|---|
| `robot_sssom.tsv` | A general collection of SSSOM mappings, including `term replaced by` annotations, formatted as a ROBOT table. **Note:** The contents of the legacy `term_mapping` resource should be merged into this template. Eventually to be restructured into a non-ROBOT SSSSOM template, renamed `sssom_template.tsv`, that gets converted into a compatible ROBOT integration. | `sssom.ofn` | [TBD] |
| `robot_sssom_geoname.tsv` | [PENDING] SSSOM mappings from GENEPIO geographic terms to [GeoNames](https://www.geonames.org/) identifiers. Would eventually need a queryable backbone to keep mappings current. | `geographical.ofn` | [TBD] |
| `robot_sssom_wikidata.tsv` | [PENDING] SSSOM mappings providing `replaces` annotations for [GAZ](http://purl.obolibrary.org/obo/gaz) terms with Wikidata equivalents. | `geographical.ofn` | [TBD] |

### Branch templates (`robot_branch_*`)

Branch-specific templates covering distinct domain subtrees (e.g. identifier, host characteristic, sequencing instrument model). Each branch template has a 1-to-1 or 1-to-many relationship with its corresponding component.

| Element | Description | Target Component | Source Tab Name |
|---|---|---|---|
| `robot_branch_*.tsv` | [Example row] | `branch.ofn` | [TBD] |

## Patterns

### File naming conventions

All template files follow the pattern:

```
robot_{category}_{name}.tsv
```

| Segment | Description |
|---|---|
| `robot` | Fixed prefix indicating a ROBOT template file. |
| `{category}` | The functional category of the template. |
| `{name}` | A short, descriptive name; typically the target ontology (for temp), the mapping source (for sssom), or the tab/aspect (for branches or projects). |


### Guidelines

- **Tab names:** The `{category}_{name}` portion of the file name should correspond to the tab name in the [GENEPIO_ROBOT Tables](https://docs.google.com/spreadsheets/d/1Ieo0jokfXBbWIQv32g5D5s7x8FIeh7f-gGX6qI6AhN0/) workbook (e.g. `robot_spec_field.tsv` ↔ `spec_field` tab).
- **Header rows:** Every template TSV must have (1) a human-readable header row and (2) a ROBOT template string row, per the [ROBOT template specification](http://robot.obolibrary.org/template.html). Refer to the **LEGEND** tab for available annotation headers and their ROBOT commands.
- **Registration:** If a new template feeds a new component, the component must also be registered in `src/ontology/genepio-odk.yaml` with `use_template: true` and the template file(s) listed.
- **ID ranges:** Coordinate new term IDs via `genepio-idranges.owl` and the [GENEPIO_Term ID Reservations](https://docs.google.com/spreadsheets/d/1Ieo0jokfXBbWIQv32g5D5s7x8FIeh7f-gGX6qI6AhN0/) spreadsheet to avoid collisions.
- **SSSOM conversion:** SSSOM templates are currently in ROBOT template format. The long-term plan is to migrate to native SSSOM TSV format with automated conversion (see [SSSOM spec](https://mapping-commons.github.io/sssom/)).
