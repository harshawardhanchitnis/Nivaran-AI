import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyFacts } from '../facts/verify-facts.js';
import { createImageQuoteChecker } from '../verify/quote.js';
import { downloadDocument } from '../reader/download-document.js';
import { createDocumentReader } from '../reader/read-document.js';
import { HttpError } from '../http.js';
import { createAgentToolChooser } from './model.js';
import type { InvestigationDependencies } from './loop.js';

export function createInvestigationDependencies(client: SupabaseClient): InvestigationDependencies {
  return {
    choose: createAgentToolChooser(client),
    check: (snapshot, role) => verifyFacts(snapshot.documents, snapshot.evidence, snapshot.facts, {
      download: document => downloadDocument(client, document), images: createImageQuoteChecker(client, role),
    }),
    reread: createDocumentReader(client),
    // T7 supplies the pure ladder here. Until then the server cannot invent a plan.
    nextStep: async () => { throw new HttpError(503, 'next_step_unavailable', 'The next step is not available yet. Your facts are saved.'); },
  };
}
