import { ArrowLeft, MapPinned } from 'lucide-react';

type LegalPageKind = 'about' | 'privacy' | 'terms' | 'guide' | 'contact';

type LegalPageContent = {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

const PAGES: Record<LegalPageKind, LegalPageContent> = {
  about: {
    title: 'About Map Measurement',
    updated: 'June 5, 2026',
    intro:
      'Map Measurement is a free satellite measurement tool for professionals who need fast planning estimates for building footprints, parking lots, perimeters, and site distances.',
    sections: [
      {
        heading: 'What it is for',
        body:
          'The app is designed for early planning, estimating, property review, and field-prep workflows where a quick satellite-based measurement is useful before deeper engineering or survey work.'
      },
      {
        heading: 'What it is not',
        body:
          'Measurements are not survey-grade and should not replace stamped drawings, boundary surveys, legal plats, engineering plans, or jurisdiction-required measurements.'
      },
      {
        heading: 'How it stays free',
        body:
          'The tool is intended to remain free for users and may be supported by clearly labeled advertising or sponsorship placements.'
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'June 5, 2026',
    intro:
      'This policy explains how Map Measurement handles data when you use the satellite measurement tool.',
    sections: [
      {
        heading: 'Measurement data',
        body:
          'Drawn shapes, names, and measurement results are stored in your browser local storage so your work can reopen on the same device. This version does not run a backend database or user accounts for measurement projects.'
      },
      {
        heading: 'Map provider data',
        body:
          'Satellite imagery is loaded through Mapbox. When the map loads, Mapbox may receive standard request data such as IP address, browser information, map tile requests, and interaction signals according to its own terms and privacy practices.'
      },
      {
        heading: 'Advertising data',
        body:
          'If advertising is enabled and you allow sponsor ads, ad partners such as Google AdSense may use cookies, web beacons, IP addresses, device identifiers, or similar technologies to serve and measure ads. Ad behavior depends on the site owner\'s ad settings and applicable consent requirements.'
      },
      {
        heading: 'Exports',
        body:
          'GeoJSON and CSV exports are generated in your browser and downloaded to your device. Exported files contain the measurement names, geometry, and calculated values shown in the app.'
      },
      {
        heading: 'Contact',
        body:
          'Before public launch, replace this section with the site owner\'s contact email or business mailing address so users and ad partners have a clear privacy contact.'
      }
    ]
  },
  terms: {
    title: 'Terms of Use',
    updated: 'June 5, 2026',
    intro:
      'These terms describe the intended use and limits of Map Measurement.',
    sections: [
      {
        heading: 'Planning estimates only',
        body:
          'The app provides approximate measurements based on satellite imagery, map data, and manually placed vertices. Results can be affected by imagery age, resolution, perspective, roof overhangs, map projection assumptions, and user input.'
      },
      {
        heading: 'Professional responsibility',
        body:
          'Users are responsible for validating measurements before relying on them for pricing, construction, permitting, compliance, legal, safety, or engineering decisions.'
      },
      {
        heading: 'Availability',
        body:
          'The app is provided as a free tool and may change, pause, or stop operating. Map imagery, ads, exports, and local storage may depend on third-party services or browser settings.'
      },
      {
        heading: 'Advertising',
        body:
          'Advertising or sponsorship areas may appear in the app. Ads should not be interpreted as professional recommendations or endorsements.'
      }
    ]
  },
  guide: {
    title: 'How to Measure Buildings and Parking Lots',
    updated: 'June 5, 2026',
    intro:
      'Use this guide to get practical planning estimates from satellite imagery while avoiding common measurement mistakes.',
    sections: [
      {
        heading: 'Start with the property search',
        body:
          'Search for an address, city, or place, then choose the closest result. Zoom in until building edges, parking rows, curbs, or paved boundaries are clear enough to place vertices consistently.'
      },
      {
        heading: 'Measure building footprints',
        body:
          'Use the polygon tool and click around the visible roof or footprint edge. For buildings with overhangs, angled imagery, or shadows, treat the result as a planning estimate and compare it against drawings or field measurements when available.'
      },
      {
        heading: 'Measure parking lots and paved areas',
        body:
          'Use the polygon tool around the paved boundary, excluding landscaped islands or medians only when they matter to your estimate. Large lots are easier to measure by drawing fewer, deliberate points around the perimeter.'
      },
      {
        heading: 'Measure distances',
        body:
          'Use the line tool for drive aisles, frontage, building edges, setbacks, or quick span checks. The line distance updates in feet and meters and can be exported with the rest of the project.'
      },
      {
        heading: 'Export for professional workflows',
        body:
          'Export CSV for estimating spreadsheets, or GeoJSON for GIS-style workflows. Exports include measurement names, geometry, area, perimeter, length, and center coordinates.'
      }
    ]
  },
  contact: {
    title: 'Contact',
    updated: 'June 5, 2026',
    intro:
      'Use this page for questions about the free measurement tool, privacy requests, advertising inquiries, or professional feedback.',
    sections: [
      {
        heading: 'Site owner contact',
        body:
          getContactEmail()
            ? `Email: ${getContactEmail()}`
            : 'Before public launch, set VITE_CONTACT_EMAIL to a monitored site owner email address.'
      },
      {
        heading: 'Measurement questions',
        body:
          'For project-specific decisions, verify app measurements against survey data, construction documents, field measurements, or other authoritative sources before relying on them.'
      },
      {
        heading: 'Advertising inquiries',
        body:
          'Sponsors and advertisers should contact the site owner listed above once the public production domain is active.'
      }
    ]
  }
};

export function getLegalPageKind(pathname: string): LegalPageKind | null {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  if (route === 'about' || route === 'privacy' || route === 'terms' || route === 'guide' || route === 'contact') {
    return route;
  }

  return null;
}

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const content = PAGES[kind];

  return (
    <main className="legal-shell">
      <article className="legal-document">
        <a className="back-link" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to measurement tool
        </a>
        <p className="eyebrow">Map Measurement</p>
        <h1>{content.title}</h1>
        <p className="legal-updated">Last updated: {content.updated}</p>
        <p className="legal-intro">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <footer className="legal-footer">
          <MapPinned size={16} aria-hidden="true" />
          <span>Use this tool for planning estimates only, not survey-grade or legal measurements.</span>
        </footer>
      </article>
    </main>
  );
}

function getContactEmail(): string {
  return (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ?? '';
}
