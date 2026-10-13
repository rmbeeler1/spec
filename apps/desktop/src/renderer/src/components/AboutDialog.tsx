import { useEffect, useState } from 'react'
import logo from '@branding/spec-logo-web.png'

interface Props {
  onClose(): void
}

export function AboutDialog({ onClose }: Props): React.JSX.Element {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.spec.getAppVersion().then(setVersion)
  }, [])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog about-dialog" onClick={(e) => e.stopPropagation()}>
        <img className="about-logo" src={logo} alt="Spec: screenwriting software" />
        <p className="about-version">Version {version || '…'}</p>
        <p className="about-blurb">
          A free, open-source, offline-first screenwriting app. Your script lives in a plain
          Fountain file that is yours forever.
        </p>
        <p className="about-blurb">
          MIT licensed ·{' '}
          <a
            href="https://github.com/rmbeeler1/spec"
            target="_blank"
            rel="noreferrer"
          >
            github.com/rmbeeler1/spec
          </a>
        </p>
        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
