import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FranchiseApplication, FranchiseEventType } from '@/models/entities/Franchise';

export interface AgreementInput {
  eventType: Extract<FranchiseEventType, 'succession_transfer' | 'third_party_transfer' | 'termination'>;
  effectiveDate: string;
  fromHolder: string;
  toHolder?: string;
  relationship?: string;
  reason?: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export class FranchiseAgreementService {
  static agreementNumber(franchiseId: string): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    return `KAS-${stamp}-${franchiseId.slice(0, 6).toUpperCase()}`;
  }

  static buildText(franchise: FranchiseApplication, input: AgreementInput, number: string): string {
    const action = input.eventType === 'termination'
      ? 'PAGWAWAKAS NG PRANGKISA'
      : input.eventType === 'succession_transfer'
      ? 'PAGLILIPAT NG PRANGKISA SA TAGAPAGMANA'
      : 'PAGLILIPAT / PAGBEBENTA NG PRANGKISA';
    const recipient = input.toHolder
      ? `Ang bagong may hawak ay si ${input.toHolder}${input.relationship ? ` (${input.relationship.replace(/_/g, ' ')})` : ''}.`
      : '';
    const reason = input.reason ? `Dahilan: ${input.reason}.` : '';

    return [
      'KASUNDUAN / AGREEMENT',
      `Agreement No.: ${number}`,
      '',
      action,
      '',
      `Franchise / MTOP No.: ${franchise.mtop_number || 'Pending assignment'}`,
      `Tricycle Body No.: ${franchise.body_number || 'Not assigned'}`,
      `Plate No.: ${franchise.plate_number}`,
      `TODA: ${franchise.toda}`,
      `Dating may hawak: ${input.fromHolder}`,
      recipient,
      reason,
      `Petsa ng bisa: ${input.effectiveDate}`,
      '',
      'Ang kasunduang ito ay itinatala para sa opisyal na rekord ng TODA at sasailalim sa pagpapatunay at mga kinakailangan ng LGU/TODA. Ang paglagda rito ay hindi pumapalit sa anumang permit, clearance, o pag-apruba na hinihingi ng batas o lokal na patakaran.',
      '',
      '______________________________        ______________________________',
      'Franchise Holder / Authorized Party     TODA/LGU Authorized Officer',
    ].filter((line) => line !== '').join('\n');
  }

  static async shareAgreement(text: string, number: string): Promise<void> {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(number)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:48px auto;line-height:1.65;color:#263c30;padding:0 28px}pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:15px}h1{text-align:center;font-size:22px}</style></head><body><h1>KASUNDUAN / AGREEMENT</h1><pre>${escapeHtml(text.replace(/^KASUNDUAN \/ AGREEMENT\n/, ''))}</pre></body></html>`;
    const fileName = `${number}.html`;

    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = (FileSystem as any).documentDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, html);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'text/html' });
  }
}
