# Shipped coverage register

This is an inventory of the current synthetic application, not a certification of parity with ServiceNow HRSD or Platform Analytics. All 38 catalog entries below have a route in the People / HR Operations interface and an inspector. Their synthetic calculations, time basis and any definition gates are shown in the app. A gated view deliberately withholds a score where the definition or data is insufficient.

The app additionally has 12 enterprise/cohort inspectors (C01 and E01–E11), six decision labs and a constrained portfolio view. It does not resolve real HR cases or make individual employment decisions.

| ID | Area / pillar | View | Display segmentation |
| --- | --- | --- | --- |
| O01 | operations / onboarding | Average onboarding time | overall |
| O02 | operations / onboarding | Onboarding time trend | time |
| O03 | operations / onboarding | Onboarding time by HR service | HR service |
| O04 | operations / care | Backlog growth | overall |
| O05 | operations / care | Open HR cases | overall |
| O06 | operations / care | Resolution time by priority | priority over time |
| O07 | operations / care | Open cases by age | case age band |
| O08 | operations / improve | Open cases breaching SLA | overall |
| O09 | operations / improve | Unassigned open cases | overall |
| O10 | operations / improve | SLA breaches by priority | priority over time |
| O11 | operations / improve | Unassigned cases by priority | priority over time |
| O12 | operations / satisfaction | Case survey score | overall |
| O13 | operations / satisfaction | Survey score by priority | priority |
| O14 | operations / satisfaction | Survey score by source | survey source |
| O15 | operations / relations | Open employee relations cases | overall |
| O16 | operations / relations | Employee relations past SLA | overall |
| O17 | operations / relations | Open relations cases by priority | priority |
| O18 | operations / relations | Relations past SLA by department | department |
| P01 | people / grow | Headcount | overall |
| P02 | people / grow | Time to fill | overall |
| P03 | people / grow | Internal hire share | time |
| P04 | people / grow | Time-to-fill trend | time |
| P05 | people / develop | Ramp-up completion | overall |
| P06 | people / develop | Demands converted to projects | last 12 months |
| P07 | people / develop | Employees submitting goals | time |
| P08 | people / develop | Promotion rate by job level | job level |
| P09 | people / diversify | DEI index | overall |
| P10 | people / diversify | Women representation | overall |
| P11 | people / diversify | Women by job level | job level |
| P12 | people / diversify | Race and ethnicity by job level | race/ethnicity and job level |
| P13 | people / empower | Regrettable attrition | overall |
| P14 | people / empower | Employees per HR staff | overall |
| P15 | people / empower | Persona mix | persona |
| P16 | people / empower | Hiring mix | hire category |
| P17 | people / reward | Recognition | overall |
| P18 | people / reward | Rewards | overall |
| P19 | people / reward | Revenue per employee | time |
| P20 | people / reward | On-target earnings per employee | time |

The source mapping embedded in public/index.html records the referenced ServiceNow catalog and indicator URLs. It preserves caveats such as the backlog-growth label/source mismatch and undefined DEI-index formula. Use Trust → Coverage and Definitions to inspect those boundaries. Product tests exercise all 38 routes and six labs; visual and hardware-browser verification is separately disclosed in VALIDATION.md.
