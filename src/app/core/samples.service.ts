import { Injectable } from '@angular/core';
import type { SavedSample } from '@shared/samples';
import { sampleCase, sampleDocumentPath } from '@shared/samples';

@Injectable({ providedIn: 'root' })
export class SamplesService {
  async load(id: string): Promise<SavedSample> {
    if (!sampleCase(id)) throw new Error('This sample does not exist.');
    const response = await fetch(`/samples/${id}/run.json`);
    if (!response.ok) throw new Error('Could not open the saved run. Please try again.');
    const saved = await response.json() as SavedSample;
    if (saved.id !== id || saved.documents.length > 6 || saved.documents.some(row => row.user_id !== 'synthetic-evaluation-owner')) throw new Error('This saved run is unavailable.');
    saved.documents.forEach(row => sampleDocumentPath(saved, row));
    return saved;
  }
  async files(id: string): Promise<File[]> {
    const sample = await this.load(id);
    return Promise.all(sample.documents.map(async document => {
      const response = await fetch(sampleDocumentPath(sample, document));
      if (!response.ok) throw new Error('Could not load the synthetic sample files. Try again.');
      return new File([await response.blob()], document.file_name, { type: document.mime_type });
    }));
  }
}
