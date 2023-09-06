# coding: utf-8
import pandas as pd
import codecs


df = pd.read_excel('INSDC to Gaz.xlsx')
template = u'''
     <!-- http://purl.obolibrary.org/obo/{id} -->

    <owl:Class rdf:about="http://purl.obolibrary.org/obo/{id}">
        <oboInOwl:hasDbXref rdf:datatype="http://www.w3.org/2001/XMLSchema#string">{raw_item}</oboInOwl:hasDbXref>
        <rdfs:label xml:lang="en">{content}</rdfs:label>
    </owl:Class>

'''


def gen(row):
    return template.format(id=row['Gaz_Term_ID'], raw_item=row['raw_item (INSDC)'], content=row['Gaz_Term'])


df.columns = map(lambda x: x.strip(), df.columns)
chunks = df.apply(gen, axis=1)

with codecs.open('output.txt', 'w', 'utf-8') as f:
    for chunk in chunks:
        f.write(chunk)
