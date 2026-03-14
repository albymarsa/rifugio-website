/**
 * Google Apps Script per ricevere le prenotazioni dal sito del rifugio.
 *
 * Cosa fa:
 * 1. Riceve i dati del form dal sito web
 * 2. Li salva in un foglio Google Sheets
 * 3. Invia una email di notifica all'associazione
 *
 * ISTRUZIONI: vedi il file README.md nella cartella principale del progetto.
 */

// ============================================
// CONFIGURAZIONE - Modifica questi valori
// ============================================
const EMAIL_NOTIFICA = 'info@rifugioalpine.it'; // Email dove ricevere le notifiche
const NOME_RIFUGIO = 'Rifugio Alpine';
// ============================================

function doPost(e) {
  try {
    // Leggi i dati inviati dal form
    var dati = JSON.parse(e.postData.contents);

    // Apri il foglio Google Sheets (usa il foglio attivo)
    var foglio = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Se il foglio è vuoto, aggiungi le intestazioni
    if (foglio.getLastRow() === 0) {
      foglio.appendRow([
        'Data richiesta',
        'Nome',
        'Email',
        'Telefono',
        'Data arrivo',
        'Data partenza',
        'Persone',
        'Note',
        'Stato'
      ]);

      // Formatta le intestazioni in grassetto
      foglio.getRange(1, 1, 1, 9).setFontWeight('bold');
    }

    // Aggiungi una nuova riga con i dati della prenotazione
    foglio.appendRow([
      new Date().toLocaleString('it-IT'),
      dati.nome || '',
      dati.email || '',
      dati.telefono || '',
      dati.data_arrivo || '',
      dati.data_partenza || '',
      dati.persone || '',
      dati.note || '',
      'Da confermare'
    ]);

    // Invia email di notifica
    inviaNotifica(dati);

    // Rispondi con successo
    return ContentService.createTextOutput(
      JSON.stringify({ stato: 'ok', messaggio: 'Prenotazione ricevuta' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (errore) {
    return ContentService.createTextOutput(
      JSON.stringify({ stato: 'errore', messaggio: errore.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function inviaNotifica(dati) {
  var oggetto = NOME_RIFUGIO + ' - Nuova richiesta di prenotazione';

  var corpo =
    'Nuova richiesta di prenotazione ricevuta!\n\n' +
    '-------------------------------------\n' +
    'Nome: ' + (dati.nome || '-') + '\n' +
    'Email: ' + (dati.email || '-') + '\n' +
    'Telefono: ' + (dati.telefono || '-') + '\n' +
    'Data arrivo: ' + (dati.data_arrivo || '-') + '\n' +
    'Data partenza: ' + (dati.data_partenza || '-') + '\n' +
    'Numero persone: ' + (dati.persone || '-') + '\n' +
    'Note: ' + (dati.note || '-') + '\n' +
    '-------------------------------------\n\n' +
    'Ricordati di rispondere entro 48 ore.\n' +
    'Puoi gestire le prenotazioni dal foglio Google Sheets.';

  MailApp.sendEmail(EMAIL_NOTIFICA, oggetto, corpo);
}

// Funzione di test - eseguila per verificare che tutto funzioni
function test() {
  var datiTest = {
    nome: 'Mario Rossi',
    email: 'mario@test.it',
    telefono: '333 1234567',
    data_arrivo: '2026-07-15',
    data_partenza: '2026-07-16',
    persone: '4',
    note: 'Arriviamo nel pomeriggio'
  };

  var fakeEvent = {
    postData: {
      contents: JSON.stringify(datiTest)
    }
  };

  var risultato = doPost(fakeEvent);
  Logger.log(risultato.getContent());
}
