import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyFacts } from '../facts/verify-facts.js';
import { createImageQuoteChecker } from '../verify/quote.js';
import { downloadDocument } from '../reader/download-document.js';
import { createDocumentReader } from '../reader/read-document.js';
import { nextStep } from '../ladder/engine.js';
import { indiaToday } from '../ladder/dates.js';
import { merchantSaysRefundProcessed } from '../ladder/refund-not-received.js';
import { createAgentToolChooser } from './model.js';
import type { InvestigationDependencies } from './loop.js';

export function createInvestigationDependencies(client: SupabaseClient, today: () => string = indiaToday): InvestigationDependencies {
  return {
    choose: createAgentToolChooser(client),
    check: (snapshot, role) => verifyFacts(snapshot.documents, snapshot.evidence, snapshot.facts, {
      download: document => downloadDocument(client, document), images: createImageQuoteChecker(client, role),
    }),
    reread: createDocumentReader(client),
    nextStep: async (facts, snapshot) => nextStep(facts, today(), {
      refundProcessed: merchantSaysRefundProcessed(facts, snapshot.evidence),
    }),
  };
}
