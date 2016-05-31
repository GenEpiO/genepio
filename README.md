## GenEpiO ontology

Here we propose a Genomic Epidemiology Ontology (GenEpiO) that covers vocabulary necessary to identify, document and research foodborne pathogens and associated outbreaks.  We envision various subdomains including genomic laboratory testing, specimen and isolate metadata, and epidemiological case investigations.  Terms for these subdomains have partially been implemented in the main file, **genepio.owl**, which imports terms from over 25 OboFoundry.org ontologies.  Also we have added a number of terms that so far haven't been covered via OboFoundry.  

Recognizing that GenEpiO encompasses many domains, we are advocating a consortium approach for enhancing its content via interested parties that need particular domain terminology.  As the consortium gets going, the GenEpiO ontology will be moved to its own github location.

**GenEpiO is under development - it is not rolled-out in OboFoundry yet.  Its existing content requires a few more editing passes for proper description and placement of terms.**  A **[proof sheet](http://htmlpreview.github.io/?https://github.com/GenEpiO/genepio/blob/master/proofsheet/index.html)** of the data specifications and measurable datums it contains is available .  See the **[Wiki](https://github.com/GenEpiO/genepio/wiki)** pages for an introduction to its scope and design approach.  As well, GenEpiO has a quality control section being referenced by our new [RCQC tool](https://github.com/Public-Health-Bioinformatics/rcqc) for analyzing genomic pipeline log files.

Soon we will have these key documents ready for public review:
* [GenEpiO Upper Level Schema](https://docs.google.com/spreadsheets/d/1uiM1c9bsQbCLZnhpgeEEWDPKyCudnAAxdl0a1p9fKTU) (consortium access only)
* [GenEpiO Consortium Draft Organization Document](https://docs.google.com/document/d/1jPVtpEVq_SHc7PVxxK6VAHMmeaHOgrvoKedtJPpest8) (consortium access only)

## IRIDA ontology

The Integrated Rapid Infectious Disease Analysis project (IRIDA, http://www.irida.ca) uses **genepio.owl** for most of its ontology. The **ifm.owl** and its dependent, **ifm_irida.owl** are highly experimental and not synchronized with the latest GenEpiO.  IFM stands for Interface Model Ontology, and this is our own effort to add information required to draft a user interface to present GenEpiO entity information for reporting and editing.  The ifm_irida.owl file adds IRIDA specific information to the user interface.
