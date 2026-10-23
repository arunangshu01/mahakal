import { useMemo } from 'react'
import PanelTitle from './PanelTitle'
import './hud.css'

const randomHexLine = () =>
  Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0'),
  ).join(' ')

function moduleList(providers) {
  const online = (configured) => (providers === null ? 'CHECKING' : configured ? 'ONLINE' : 'OFFLINE')
  return [
    { key: 'BRAIN', name: 'GROQ · GPT-OSS', state: online(providers?.groq) },
    { key: 'BACKUP', name: 'GEMINI', state: online(providers?.gemini) },
    { key: 'EARS', name: 'WHISPER', state: online(providers?.groq || providers?.gemini) },
    { key: 'VOICE', name: 'EDGE TTS', state: 'ONLINE' },
  ]
}

export default function Modules({ status, providers }) {
  const hexLines = useMemo(() => Array.from({ length: 30 }, randomHexLine), [])

  return (
    <section className="panel panel-right" aria-label="Modules">
      <PanelTitle>Modules</PanelTitle>
      <ul className="modules">
        {moduleList(providers).map(({ key, name, state }) => (
          <li className="module" key={key}>
            <span className="module-key">{key}</span>
            <span className="module-name">{name}</span>
            <span className={`module-state ${state.toLowerCase()}`}>{state}</span>
          </li>
        ))}
      </ul>

      <PanelTitle>Data Stream</PanelTitle>
      <div className={`hexstream ${status !== 'idle' ? 'fast' : ''}`} aria-hidden="true">
        <div>
          {[...hexLines, ...hexLines].map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <PanelTitle>Mantra</PanelTitle>
      <p className="mantra" lang="sa">
        ॐ नमः शिवाय
      </p>
    </section>
  )
}
