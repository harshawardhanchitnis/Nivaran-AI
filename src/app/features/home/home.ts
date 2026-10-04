import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { EvidenceTag } from '../../shared/ui/evidence-tag';
import { StatusChip } from '../../shared/ui/status-chip';
import { SampleCard } from '../samples/sample-card';
import { SAMPLE_CARDS } from '../samples/sample-catalogue';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatIconModule, StatusChip, EvidenceTag, SampleCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly samples = SAMPLE_CARDS.slice(0, 3);

  protected readonly trust = [
    { icon: 'person_off', text: 'No sign-up' },
    { icon: 'link', text: 'Every fact linked to its source' },
    { icon: 'how_to_reg', text: 'You approve before anything is drafted' },
    { icon: 'delete_outline', text: 'Delete your case any time' },
  ] as const;

  protected readonly problems = [
    {
      icon: 'folder_off',
      title: 'The evidence is scattered',
      text: 'The invoice is a PDF, the refund promise is an email, the support chat is a screenshot. Putting the facts together is the first hurdle.',
    },
    {
      icon: 'help_outline',
      title: 'Who do I write to, and when?',
      text: 'Online sellers must have a grievance officer, but finding them, and knowing what to do when they do not answer, is not obvious.',
    },
    {
      icon: 'event_busy',
      title: 'Deadlines slip by',
      text: 'The seller has 48 hours to acknowledge and one month to resolve. Without the dates in front of you, the case goes cold.',
    },
  ] as const;

  protected readonly features = [
    { icon: 'document_scanner', title: 'Reads your documents', text: 'Invoices, emails and screenshots. Each fact is taken with the exact words it came from.' },
    { icon: 'link', title: 'Shows the source of every fact', text: 'Tap a fact to see the document page and the highlighted quote. A quote that cannot be found is marked for your check.' },
    { icon: 'quiz', title: 'Asks only what it must', text: 'When two documents disagree, or something is missing, you get one question with one-tap answers.' },
    { icon: 'alt_route', title: 'Works out the next step', text: 'Code, not the AI, decides the step and calculates the dates from rules a person has checked.' },
    { icon: 'edit_note', title: 'Drafts the complaint', text: 'The AI writes the wording; code inserts every amount, date and ID from your evidence and flags anything else.' },
    { icon: 'event_available', title: 'Follows the case through', text: 'Record when you sent it, add the deadlines to your calendar, and tell Nivaran what happened next.' },
  ] as const;

  protected readonly steps = [
    { title: 'Add your documents', text: 'Up to six PDFs, photos or screenshots. Consent comes first; files stay private to you.' },
    { title: 'Check the facts', text: 'A fact sheet with five honest statuses. Answer a question if your documents disagree.' },
    { title: 'Approve the plan', text: 'See the next step, why it applies, its sources and its dates. Nothing is drafted until you approve.' },
    { title: 'Send it yourself', text: 'Edit the complaint, print or copy it, and send it. Then record what happened.' },
  ] as const;

  protected readonly ladder = [
    { step: 0, title: 'Wait for the promised date', when: 'The refund is not late yet', detail: 'Nothing to send. Nivaran shows the date to watch.' },
    { step: 1, title: "Write to the seller's grievance officer", when: 'The refund is overdue', detail: 'They must acknowledge within 48 hours and resolve within one month (E-Commerce Rules 2020, rule 4(5)).' },
    { step: 2, title: 'National Consumer Helpline', when: 'No reply, no resolution, or a refusal', detail: 'Call 1915 or use the portal. The helpline says it can take up to 30 days.' },
    { step: 3, title: 'Consumer Commission', when: 'The helpline does not resolve it', detail: 'Filed through e-Jagriti. Nivaran gives information here and prepares nothing.' },
  ] as const;

  protected readonly faqs = [
    { q: 'Is this legal advice?', a: 'No. Nivaran organises your evidence and follows a recommended order of steps. The order is good practice, not a legal requirement. For advice about your situation, speak to a lawyer or the National Consumer Helpline.' },
    { q: 'Does Nivaran send or file anything for me?', a: 'Never. No part of the AI can send, file, pay or delete. You review the complaint, and you send it yourself.' },
    { q: 'What happens to my documents?', a: 'They are stored privately under your session and sent to Google’s Gemini model or Groq to be read. On the free tier, Google may use that content to improve its products, so hide card numbers before uploading. You can delete your case, files and records at any time.' },
    { q: 'What if my documents disagree?', a: 'Nivaran shows both sources side by side and asks you which is right. It does not pick one for you.' },
    { q: 'How do I know a fact is real?', a: 'Every fact shows the document and the exact words it came from. Quotes from PDFs are matched by code. A document shows what it says; it is not proof that something happened.' },
    { q: 'Which cases does it handle?', a: 'Online orders where a refund is owed and has not arrived: a cancelled prepaid order, an accepted return, or a refund the seller confirmed in writing. Bank or UPI disputes and arguments over whether a refund is owed are not covered.' },
  ] as const;
}
