## The Genomic Epidemiology Ontology

[![Build Status](https://travis-ci.org/GenEpiO/genepio.svg?branch=master)](https://travis-ci.org/GenEpiO/genepio)

This is the GitHub repository for the Genomic Epidemiology Ontology, an application ontology that belongs to the OBOFoundry family of ontologies.  For more information on the project itself, including consortium working group details and GenEpiO ontology design information, please go to [http://genepio.org](http://genepio.org).  To view the consortium's new email list, go to https://groups.google.com/forum/#!forum/genepio. To join the list, visit https://groups.google.com/forum/#!forum/genepio/join (you don't need a Google account for this).

The [Issues](https://github.com/GenEpiO/genepio/issues) tab dives deep into particular GenEpiO design and implementation questions being resolved.  You can make new term requests here too.

A handy way to view this ontology's content is via a web service like the [EBI Ontology Lookup Service](https://www.ebi.ac.uk/ols/ontologies/genepio) or [Ontobee](http://www.ontobee.org) service.

Many terms have been collected in the main file, **genepio.owl**, which imports terms from over 25 OBOFoundry.org ontologies (as listed in the **/imports/** folder).

### Key ontologies that GenEpiO draws upon
[CHEBI](http://www.ebi.ac.uk/chebi/),
[CHMO](http://www.obofoundry.org/ontology/chmo.html),
[DOID](http://www.disease-ontology.org/),
[EFO](https://www.ebi.ac.uk/efo/),
[ENVO](http://www.environmentontology.org/),
[FOODON](http://foodon.org),
[HP](http://human-phenotype-ontology.github.io/),
[IDO](https://www.bioontology.org/wiki/index.php/Infectious_Disease_Ontology),
[NCBITaxon](http://www.obofoundry.org/ontology/ncbitaxon.html),
[NCIT](https://github.com/NCI-Thesaurus/thesaurus-obo-edition),
[OBI](http://www.obofoundry.org/ontology/obi.html),
[PATO](http://www.obofoundry.org/ontology/pato.html),
[RO](http://www.obofoundry.org/ontology/ro.html),
[SO](http://www.obofoundry.org/ontology/so.html),
[STATO](http://stato-ontology.org/),
[UBERON](http://uberon.github.io/),
[UO](http://www.obofoundry.org/ontology/uo.html)

Much of GenEpiO's content is geared towards fulfilling sequence repository standards.  We are developing a [Genomic Epidemiology Ontology Mart (GEEM)](http://genepio.org/geem) portal to enable users to browse GenEpiO content via web forms that detail fields for these standards.  It currently displays all of the GenEpiO "Data Representational model" data standard / data standard component / draft data standard entities found within GenEpiO.

### Build notes

Genepio owl products are generated using the linux Makefile command at command line, such as "> **make**" to generate genepio-merged.owl from genepio-edit.owl, "**make reason*"" to validate its logic, or "**make prepare_release**" to copy resulting build up to root folder of repo.

If when running **make** or when running "**robot**" directly you encounter obscure robot OWLAPI errors such as "java.lang.IllegalArgumentException: URI is not absolute", install Apache jena and use the "**riot**" command to validate an owl/xml version of genepio-edit.owl. (For Mac users, to install **riot**, use "> brew install jena").  In Protege, save a copy of genepio-edit.owl (which is in rdf/xml syntax) to an owl/xml syntax as genepio-validate.owl :

> riot -v --validate genepio-validate.owl

After a successful **make** build, you can test that robot is able to read genepio correctly via:

> robot convert -i genepio-merged.owl -o genepio.json

