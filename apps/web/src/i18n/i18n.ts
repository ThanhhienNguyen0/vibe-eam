export type Language = 'de' | 'en';

export type I18nKey =
  | 'section.branch'
  | 'section.palette'
  | 'section.diagrams'
  | 'section.heatmap'
  | 'section.filter'
  | 'section.tools'
  | 'section.language'
  | 'section.navigation'
  | 'action.newDiagram'
  | 'prompt.newDiagram'
  | 'action.newBranch'
  | 'prompt.newBranch'
  | 'placeholder.heatmapKey'
  | 'placeholder.search'
  | 'action.autoLayout'
  | 'action.impactDemo'
  | 'action.exportCsv'
  | 'toast.exportedCsv'
  | 'label.relation'
  | 'label.branch'
  | 'label.diagram'
  | 'nav.diagrams'
  | 'nav.catalogues'
  | 'nav.repository'
  | 'action.newElement'
  | 'prompt.newElement'
  | 'hint.dragHere'
  | 'hint.selectDiagram'
  | 'hint.empty'
  | 'layer.all';

type Dict = Record<I18nKey, string>;

const de: Dict = {
  'section.navigation': 'Navigation',
  'section.branch': 'Branch',
  'section.diagrams': 'Diagramme',
  'section.palette': 'Katalog (Drag & Drop)',
  'section.heatmap': 'Heatmap',
  'section.filter': 'Filter',
  'section.tools': 'Tools',
  'section.language': 'Sprache',
  'action.newDiagram': 'Neues Diagramm',
  'prompt.newDiagram': 'Name für neues Diagramm?',
  'action.newBranch': 'Neuer Branch',
  'prompt.newBranch': 'Name für neuen Branch?',
  'placeholder.heatmapKey': 'Attribut-Key (z. B. cost, risk)',
  'placeholder.search': 'Suchen…',
  'action.autoLayout': 'Auto‑Layout',
  'action.impactDemo': 'Impact (Demo)',
  'action.exportCsv': 'CSV Export (Clipboard)',
  'toast.exportedCsv': 'CSV in die Zwischenablage kopiert (Elements + Relations).',
  'label.relation': 'Relation',
  'label.branch': 'Branch',
  'label.diagram': 'Diagramm',
  'nav.diagrams': 'Diagramme',
  'nav.catalogues': 'Kataloge',
  'nav.repository': 'Repository',
  'action.newElement': 'Neues Element',
  'prompt.newElement': 'Name für neues {type}?',
  'hint.dragHere': 'Element aus dem Repository in das Diagramm ziehen',
  'hint.selectDiagram': 'Bitte zuerst ein Diagramm auswählen oder neu anlegen',
  'hint.empty': '— leer —',
  'layer.all': 'Alle',
};

const en: Dict = {
  'section.navigation': 'Navigation',
  'section.branch': 'Branch',
  'section.diagrams': 'Diagrams',
  'section.palette': 'Catalog (Drag & Drop)',
  'section.heatmap': 'Heatmap',
  'section.filter': 'Filter',
  'section.tools': 'Tools',
  'section.language': 'Language',
  'action.newDiagram': 'New diagram',
  'prompt.newDiagram': 'New diagram name?',
  'action.newBranch': 'New branch',
  'prompt.newBranch': 'New branch name?',
  'placeholder.heatmapKey': 'attribute key (e.g. cost, risk)',
  'placeholder.search': 'search…',
  'action.autoLayout': 'Auto‑layout',
  'action.impactDemo': 'Impact (demo)',
  'action.exportCsv': 'Export CSV (clipboard)',
  'toast.exportedCsv': 'CSV exported to clipboard (elements + relations).',
  'label.relation': 'Relation',
  'label.branch': 'Branch',
  'label.diagram': 'Diagram',
  'nav.diagrams': 'Diagrams',
  'nav.catalogues': 'Catalogues',
  'nav.repository': 'Repository',
  'action.newElement': 'New element',
  'prompt.newElement': 'New {type} name?',
  'hint.dragHere': 'Drag an element from the repository onto the diagram',
  'hint.selectDiagram': 'Select or create a diagram first',
  'hint.empty': '— empty —',
  'layer.all': 'All',
};

export class I18n {
  private readonly dict: Record<Language, Dict> = { de, en };

  language: Language;

  constructor(language: Language) {
    this.language = language;
  }

  t(key: I18nKey): string {
    return this.dict[this.language][key] ?? key;
  }
}

const STORAGE_KEY = 'vibe-eam.language';

export function loadLanguage(): Language {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'de' || raw === 'en') return raw;
  const prefersGerman = navigator.language?.toLowerCase().startsWith('de');
  return prefersGerman ? 'de' : 'en';
}

export function persistLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
}

