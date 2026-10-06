import { TestBed } from '@angular/core/testing';
import { QuestionCard } from './question-card';
describe('question card', () => {
  it('shows the literal quote and page before a choice and leaves saved answers disabled', async () => {
    const fixture = TestBed.createComponent(QuestionCard);
    fixture.componentRef.setInput('question', {id:'q',prompt:'Which amount?',why:'Compare the sources.',options:[{id:'one',label:'9999',sources:[{evidence:'E02',documentName:'refund.pdf',page:2,quote:'Refund: INR 9,999.00'}]}]});
    fixture.componentRef.setInput('readOnly',true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('q').textContent).toBe('Refund: INR 9,999.00');
    expect(fixture.nativeElement.textContent).toContain('page 2');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });
  it('emits a choice in one tap and disables repeat answers while saving', async () => {
    const fixture = TestBed.createComponent(QuestionCard);
    fixture.componentRef.setInput('question', { id: 'q', prompt: 'Which amount?', why: 'Two sources differ.', options: [{ id: 'one', label: 'INR 9999' }] });
    const answers: string[] = []; fixture.componentInstance.answered.subscribe(a => answers.push(a));
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click(); expect(answers).toEqual(['one']);
    fixture.componentRef.setInput('busy', true); await fixture.whenStable(); expect(button.disabled).toBe(true);
  });
  it('shows a labelled free-text form only when no choices exist', async () => {
    const fixture = TestBed.createComponent(QuestionCard);
    fixture.componentRef.setInput('question', { id: 'q', prompt: 'What is the order ID?', why: 'It is missing.', options: [] });
    const answers: string[] = []; fixture.componentInstance.textAnswered.subscribe(a => answers.push(a));
    await fixture.whenStable();
    const text = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(text.id).toBe(fixture.nativeElement.querySelector('label').htmlFor);
    text.value = '  MM-001  '; text.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(answers).toEqual(['MM-001']);
  });
  it('clears an earlier text answer when a different question arrives', async () => {
    const fixture = TestBed.createComponent(QuestionCard);
    fixture.componentRef.setInput('question', { id: 'first', prompt: 'Order ID?', why: 'Missing.', options: [] });
    await fixture.whenStable();
    const text = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    text.value = 'MM-001'; text.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('question', { id: 'next', prompt: 'Refund date?', why: 'Missing.', options: [] });
    await fixture.whenStable();
    expect(text.value).toBe('');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });
});
