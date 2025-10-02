export const locales = {
  en: {
    assistantName: 'National Bank Assistant',
    disclaimer: 'For general information only. No account information is processed in this chat.',
    fallback: "I couldn't find that right now. Here's where to check:",
    accountRedirect: 'For account-specific help, please sign in or contact support.',
    faqPrompt: 'You can ask about jobs, loans, branches, fees, or contact options.',
    quickChips: [
      { label: 'Current Jobs', value: 'Current job openings' },
      { label: 'Personal Loans', value: 'Personal loan options' },
      { label: 'Find Branch', value: 'Find a branch or ATM' },
      { label: 'Fees & Rates', value: 'Show current rates' },
      { label: 'Contact', value: 'Customer service contact' }
    ],
    handoffLabel: 'Chat with a human'
  },
  ur: {
    assistantName: 'نیشنل بینک اسسٹنٹ',
    disclaimer: 'یہ چیٹ صرف عمومی معلومات کے لیے ہے۔ اکاؤنٹ کی تفصیلات پراسیس نہیں کی جاتیں۔',
    fallback: 'میں فی الحال یہ معلومات نہیں ڈھونڈ سکا۔ براہ کرم اس لنک کو دیکھیں:',
    accountRedirect: 'اکاؤنٹ سے متعلق مدد کیلئے لاگ ان کریں یا سپورٹ سے رابطہ کریں۔',
    faqPrompt: 'ملازمتیں، قرض، برانچز، فیس یا رابطہ کے بارے میں پوچھیں۔',
    quickChips: [
      { label: 'موجودہ نوکریاں', value: 'موجودہ ملازمتیں' },
      { label: 'پرَسنل لون', value: 'ذاتی قرض کی تفصیل' },
      { label: 'برانچ تلاش کریں', value: 'قریب ترین برانچ' },
      { label: 'فیس اور شرح', value: 'موجودہ شرحیں' },
      { label: 'رابطہ', value: 'کسٹمر سروس رابطہ' }
    ],
    handoffLabel: 'انسانی ایجنٹ سے بات کریں'
  }
};

export function resolveLocale(localeKey) {
  if (localeKey && locales[localeKey]) return localeKey;
  return 'en';
}
