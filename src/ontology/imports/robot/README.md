
# ROBOT Instructions [UPDATE NEEDED]

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
robot template --template PHA4GE.tsv --input "../../genepio-merged.owl" --ontology-iri "http://purl.obolibrary.org/obo/genepio/imports/genepio-imports_PHA4GE.owl" --output ../genepio-imports_PHA4GE.owl
```

Regenerate covid_slim.owl file:
```
robot template --template covid_slim.tsv --ontology-iri "http://purl.obolibrary.org/obo/genepio/imports/covid_slim.owl" --prefix EFO:http://www.ebi.ac.uk/efo/EFO_ --prefix GSSO:http://purl.obolibrary.org/obo/GSSO_ --output ../covid_slim.owl
```

## ROBOT Command Overview

- `PHA4GE.tsv` = an example of an input tsv ROBOT template table.
- `../../genepio-merged.owl` = the input ontology which will be reference to determine the appropriate `rdfs:labels` to use.
- `http://purl.obolibrary.org/obo/foodon/imports/genepio-imports_PHA4GE.owl` = the output file PURL.
- `../genepio-imports_PHA4GE.owl` = the output file name and location relative to the current directory.

More information on input options, descriptions, and error feedback can be found at http://robot.obolibrary.org/template.


## Creating pha4ge import file:

Goal is to have an OWL version, and a tabular version of this specification, showing ontologized fields and related data. The first part of the procedure below, involving extracting content from linkml_pha4ge_import.owl IS JUST ONE TIME.  Subsequently just run the steps that take in changes to source_pha4ge_class.tsv and source_pha4ge_individual.tsv

Generate tsv from isolated .owl file of isolated processes. (Used to fetch content for google sheet via a manually exported .owl file hierarchy of existing CanCoGen work in genepio-edit.owl. Add Active Ontology > Ontology Prefix linkml: https://w3id.org/linkml/ in ontology file first.

Extract classes and properties

'''
robot export --input linkml_pha4ge_import.owl --header "ID|LABEL|Type|SubClass Of [NAME NAMED]|IAO:0000115|IAO:0000117|IAO:0000114|dc:date" --format tsv --include "classes properties" --export source_pha4ge_class.tsv
'''

Then insert second row ROBOT commands:

'''
ID	AL rdfs:label@en	TYPE	SC %	AL definition@en	A IAO:0000117 SPLIT=|	AI IAO:0000114	AT dc:date^^xsd:dateTime
'''

Then the /linkml_cancogen_import.owl can be generated from the source_pha4ge_class.tsv via:

'''
robot template --template source_pha4ge_class.tsv --prefix "linkml: https://w3id.org/linkml/" --prefix "GENEPIO:http://purl.obolibrary.org/obo/genepio/GENEPIO_" --input ../../genepio-merged.owl --ontology-iri http://purl.obolibrary.org/obo/genepio/imports/robot_pha4ge_import.owl --output source_pha4ge_class.owl
'''

Now extract individuals from linkml spec file:

'''
robot export --input linkml_pha4ge_import.owl --header "ID|LABEL|IAO:0000118|Type|description|IAO:0000115|IAO:0000112|examples|local_names|value|type_uri|see_also|required|recommended|pattern|multivalued|minimum_value|maximum_value|local_name_value|identifier|data_collection_state|created_on|comments|IAO:0000117|IAO:0000114|dc:date" --format tsv --include individuals --export source_pha4ge_individual.tsv
'''

And insert second row ROBOT commands:

'''
ID	AL rdfs:label@en	AL IAO:0000118@en	TYPE	AL linkml:description@en	AL IAO:0000115@en	AL IAO:0000112@en	I examples SPLIT=|	I local_names SPLIT=|	AT value^^xsd:string	AT type_uri^^xsd:string	AT linkml:see_also^^xsd:anyURI	AT required^^xsd:boolean	AT recommended^^xsd:boolean	AT pattern^^xsd:string	AT multivalued^^xsd:boolean	I minimum_value	I maximum_value	AT local_name_value^^xsd:string	AT identifier^^xsd:boolean	AT data_collection_state^^xsd:string	AT created_on^^xsd:dateTime	AL linkml:comments@en	A IAO:0000117	A IAO:0000114	AT dc:date^^xsd:string	
'''


And then make robot_pha4ge_import.owl out of instances converted to owl along with source_pha4ge_class.owl classes and properties:

'''
robot template --template source_pha4ge_individual.tsv --prefix linkml:https://w3id.org/linkml/ --input source_pha4ge_class.owl --ontology-iri http://purl.obolibrary.org/obo/genepio/imports/robot_pha4ge_import.owl merge --input source_pha4ge_class.owl --output robot_pha4ge_import.owl
'''

