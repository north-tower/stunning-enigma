export interface LeadClassification {
  intentType:
    | 'Buyer'
    | 'Call Request'
    | 'Product Inquiry'
    | 'Service Interest'
    | 'Support'
    | 'Networking'
    | 'Spam/Sales';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  reasoning: string;
  suggestedAction: string;
}
