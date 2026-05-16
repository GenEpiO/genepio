# Components

## Description

This folder contains the **ontology component modules** (also referred to as "modules") for the Genomic Epidemiology Ontology (GenEpiO). Components are self-contained OWL/OFN files that are imported into the main `genepio-edit.owl` and assembled during the ODK build process. Each component is generated from one or more [ROBOT templates](http://robot.obolibrary.org/template.html) located in [`src/templates/`](../templates/README.md), or from other automated processes (e.g. SSSOM mappings, SPARQL queries).

Components allow modular management of distinct areas of the ontology, such as term deprecation; data specifications; geographic entities; and cross-ontology mappings, so that they can be curated, reviewed, and rebuilt independently.

For background on ODK components, see the [ODK components documentation](https://obophenotype.github.io/bio-attribute-ontology/odk-workflows/components/).

## Folder Contents

| Element | Description | Source File(s) | Source Tab Name(s) |
|---|---|---|---|
| `deprecation.ofn` | Contains axioms for deprecated GENEPIO terms. Includes `owl:deprecated true` annotations, obsolescence reasons, and `term replaced by` references. | _not applicable_ | _not applicable_ |
| `specification.owl` | Contains specification data specifications, specification fields, specification enumerations, specification annotations, and specification picklist values (pending merge). | [`robot_spec.tsv`](../templates/robot_spec.tsv), [`robot_spec_field.tsv`](../templates/robot_spec_field.tsv), [`robot_spec_enum.tsv`](../templates/robot_spec_enum.tsv), [`robot_spec_annotations.tsv`](../templates/robot_spec_annotations.tsv), [`robot_spec_values.tsv`](../templates/robot_spec_values.tsv) | `spec`, `spec_field`, `spec_enum`, `spec_annotations`, `spec_values` |
| `planned_obsolescence.ofn` | Contains terms flagged for planned obsolescence; i.e., temporary GENEPIO terms pending adoption in another ontology. Once the replacement term is available, entries here move to `deprecation.ofn`. | [`src/templates/robot_temp_general.tsv`](../templates/robot_temp_general.tsv), [`src/templates/robot_temp_envo.tsv`](../templates/robot_temp_envo.tsv), [`src/templates/robot_temp_obi.tsv`](../templates/robot_temp_obi.tsv) | `temp_general`, `temp_envo`, `temp_obi` |
| `sssom.ofn` | Contains cross-ontology and cross-database term mappings expressed as [SSSOM](https://mapping-commons.github.io/sssom/) (Simple Standard for Sharing Ontological Mappings). | [`src/templates/robot_sssom.tsv`](../templates/robot_sssom.tsv), `src/templates/robot_sssom_geoname.tsv`, `src/templates/robot_sssom_wikidata.tsv` | `sssom`, `sssom_geoname`, `sssom_wikidata` |
| `geographical.ofn` [PENDING] | Contains geographical/location-related ontology terms. | `src/templates/robot_geographical.tsv` | [TBD] |
| `gaz_insdc_mapping.ofn` | Mappings between GAZ (Gazetteer) geographic location terms and INSDC geographic location vocabulary. | _not applicable_ | _not applicable_ |
| `gazetteer.ofn` | Gazetteer geographic entries used in GENEPIO specifications. | _not applicable_ | _not applicable_ |
| `hardcoded.ofn` | Hardcoded ontology axioms that are not derived from ROBOT templates. | _not applicable_ | _not applicable_ |

## Patterns

### File naming conventions

When adding a new component to this folder, follow these conventions:

| Pattern | Convention | Example |
|---|---|---|
| **General component** | `{domain_name}.ofn` or `{domain_name}.owl` | `geographical.ofn`, `specification.owl` |
| **Branch component** | `{branch_name}_branch.ofn` | `identifier_branch.ofn`, `host_branch.ofn` |
| **Mapping component** | `{source}_{target}_mapping.ofn` | `gaz_insdc_mapping.ofn`, `gaz_wikidata_mapping.ofn` |

### Guidelines

- **Registration:** New components must be registered in the ODK configuration file (`src/ontology/genepio-odk.yaml`) under `components: products:` so that they are imported by `genepio-edit.owl` and the XML catalog is updated accordingly.
- **Source templates:** If the component is generated from a ROBOT template, list the source template(s) under `templates:` within the component's configuration entry. See the [ODK components documentation](https://obophenotype.github.io/bio-attribute-ontology/odk-workflows/components/) for syntax.
- **ID ranges:** If a branch component manages its own set of GENEPIO IDs, coordinate the range via `genepio-idranges.owl` and the [GENEPIO_Term ID Reservations](https://docs.google.com/spreadsheets/d/1Ieo0jokfXBbWIQv32g5D5s7x8FIeh7f-gGX6qI6AhN0/) spreadsheet.
