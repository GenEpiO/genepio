
# ROBOT Instructions

Use tab separated (tsv) files rather than comma separated (csv) for you input files.

The following is the ROBOT command for generating a new OWL for GenEpiO:

```
robot template --template PHA4GE.tsv \
--input "../../genepio-merged.owl" \
--ontology-iri "http://purl.obolibrary.org/obo/genepio/imports/genepio-imports_PHA4GE.owl" \
--output ../genepio-imports_PHA4GE.owl
```

Windows 10 command line users should remove the `\` and input as a single line:

```
robot template --template PHA4GE.tsv --input "../../genepio-merged.owl" --ontology-iri "http://purl.obolibrary.org/obo/genepio/imports/genepio-imports_PHA4GE.owl" --output ../genepio-imports_PHA4GE.ow
```

## ROBOT Command Overview
- `PHA4GE.tsv` = an example of an input tsv ROBOT template table.
- `../../genepio-merged.owl` = the input ontology which will be reference to determine the appropriate `rdfs:labels` to use.
- `http://purl.obolibrary.org/obo/foodon/imports/genepio-imports_PHA4GE.owl` = the output file PURL.
- `../genepio-imports_PHA4GE.owl` = the output file name and location relative to the current directory.

More information on input options, descriptions, and error feedback can be found at http://robot.obolibrary.org/template.
