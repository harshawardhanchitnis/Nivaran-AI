-- Six guidance snippets checked by the owner against primary sources on 2 October 2026.
-- Includes the owner's correction: the ARN example concerns a cancelled online train booking.
-- Run this COMPLETE file in Supabase SQL Editor after migrations 0001 through 0007.
-- Safe to re-run. This seed changes guidance only, not usage caps or case data.
begin;
insert into public.guidance (id, title, body, source_name, source_url, checked_on, applies_to_steps)
values
  ('ecommerce-grievance-officer', 'Finding the grievance officer', 'An e-commerce entity must provide a grievance mechanism, appoint a grievance officer, and display the officer''s name, contact details and designation on its platform.', 'Consumer Protection (E-Commerce) Rules, 2020 — rule 4(4)', 'https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=8', '2026-10-02', array[1,2]::smallint[]),
  ('ecommerce-grievance-timelines', 'Complaint response timelines', 'The grievance officer must acknowledge a consumer complaint within 48 hours and redress it within one month, measured from receipt of the complaint.', 'Consumer Protection (E-Commerce) Rules, 2020 — rule 4(5)', 'https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=9', '2026-10-02', array[1,2]::smallint[]),
  ('ecommerce-refund-payment', 'Accepted refund requests', 'An e-commerce entity must pay accepted refund requests within a reasonable period or the period prescribed under applicable law, following the requirements of the RBI or other competent authority. This provision does not specify a universal seven-day refund deadline.', 'Consumer Protection (E-Commerce) Rules, 2020 — rule 4(10)', 'https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf#page=9', '2026-10-02', array[0,1,2]::smallint[]),
  ('nch-overview', 'National Consumer Helpline', 'NCH is a pre-litigation grievance mechanism. Consumers can contact it on 1915 or register through its portal. Its information page says reaching a logical conclusion may take up to 30 days; registering does not guarantee a remedy.', 'National Consumer Helpline — About, questions 1, 3, 8 and 9', 'https://consumerhelpline.gov.in/public/about', '2026-10-02', array[2]::smallint[]),
  ('nch-unresolved', 'If the helpline does not resolve it', 'A consumer dissatisfied with the helpline outcome can approach the appropriate Consumer Commission. e-Jagriti is the government''s portal for Consumer Commissions. Nivaran provides information at this step and does not prepare or file a Commission complaint.', 'National Consumer Helpline — About; official e-Jagriti portal', 'https://consumerhelpline.gov.in/public/about', '2026-10-02', array[3]::smallint[]),
  ('refund-bank-reference', 'Tracing a processed refund', 'In a published NCH case about a cancelled online train booking, the company advised the consumer to check the refund status with the card-issuing bank using the ARN it supplied. A reference supports tracing; it does not itself show that the account was credited. This example is practical tracing information, not a general legal deadline or a guarantee of recovery.', 'National Consumer Helpline — published case 1970248', 'https://consumerhelpline.gov.in/public/index.php/successstorydetails/48', '2026-10-02', array[0,1]::smallint[])
on conflict (id) do update set
  title=excluded.title, body=excluded.body, source_name=excluded.source_name,
  source_url=excluded.source_url, checked_on=excluded.checked_on,
  applies_to_steps=excluded.applies_to_steps;
commit;

-- Optional read-only confirmation: expect six rows, each checked_on = 2026-10-02.
select id, checked_on from public.guidance
where id in ('ecommerce-grievance-officer', 'ecommerce-grievance-timelines', 'ecommerce-refund-payment', 'nch-overview', 'nch-unresolved', 'refund-bank-reference') order by id;
