# Guidance — human checked on 2 October 2026

Prepared by Codex and compared by the owner with the linked primary sources on 2 October 2026.
The owner confirmed five bodies as written and corrected the train-ticket ARN example below.
All six confirmed bodies and the actual check date are in `supabase/seed.sql`. Applying that exact
file remains the owner's Supabase dashboard step. The Gazette PDF was downloaded from the Department
of Consumer Affairs and its English text read with unpdf; the owner also read rules 4(4), 4(5) and
4(10) on pages 8–9, the NCH pages and the official e-Jagriti portal.

| ID | Title / applies to steps | Confirmed body | Primary source and place to check |
|---|---|---|---|
| `ecommerce-grievance-officer` | Finding the grievance officer / 1, 2 | An e-commerce entity must provide a grievance mechanism, appoint a grievance officer, and display the officer's name, contact details and designation on its platform. | [2020 Gazette PDF, page 8, rule 4(4)](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=8) |
| `ecommerce-grievance-timelines` | Complaint response timelines / 1, 2 | The grievance officer must acknowledge a consumer complaint within 48 hours and redress it within one month, measured from receipt of the complaint. | [2020 Gazette PDF, page 9, rule 4(5)](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=9) |
| `ecommerce-refund-payment` | Accepted refund requests / 0, 1, 2 | An e-commerce entity must pay accepted refund requests within a reasonable period or the period prescribed under applicable law, following the requirements of the RBI or other competent authority. This provision does not specify a universal seven-day refund deadline. | [2020 Gazette PDF, page 9, rule 4(10)](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=9) |
| `nch-overview` | National Consumer Helpline / 2 | NCH is a pre-litigation grievance mechanism. Consumers can contact it on 1915 or register through its portal. Its information page says reaching a logical conclusion may take up to 30 days; registering does not guarantee a remedy. | [NCH About, questions 1, 3, 8 and 9](https://consumerhelpline.gov.in/public/about) |
| `nch-unresolved` | If the helpline does not resolve it / 3 | A consumer dissatisfied with the helpline outcome can approach the appropriate Consumer Commission. e-Jagriti is the government's portal for Consumer Commissions. Nivaran provides information at this step and does not prepare or file a Commission complaint. | [NCH About, questions 1 and 8](https://consumerhelpline.gov.in/public/about), [official e-Jagriti portal](https://e-jagriti.gov.in/) |
| `refund-bank-reference` | Tracing a processed refund / 0, 1 | In a published NCH case about a cancelled online train booking, the company advised the consumer to check the refund status with the card-issuing bank using the ARN it supplied. A reference supports tracing; it does not itself show that the account was credited. This example is practical tracing information, not a general legal deadline or a guarantee of recovery. | [NCH published case 1970248, railway provider response](https://consumerhelpline.gov.in/public/index.php/successstorydetails/48) |

Plan wording to retain:

- Rule 4(5) runs from **receipt**, while the scoped app calculates from the user's recorded sent
  date. The plan must identify that calculation basis; it should be adjusted if receipt was later.
- Seven days without a merchant date is Nivaran's stated working assumption. It is not in rule 4(10).
- The bank source is a published example about a card refund and an ARN. Do not turn it into a
  universal banking obligation, or handle a bank/UPI dispute inside this app.
- The escalation order is recommended practice, not a legal requirement. Nivaran is not legal advice.

The [Department's 2026 amendment announcement](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532)
states that those amendments take effect on 1 January 2027. These hackathon drafts use the 2020
provisions for October 2026; a later release needs a fresh review rather than silently retaining them.
