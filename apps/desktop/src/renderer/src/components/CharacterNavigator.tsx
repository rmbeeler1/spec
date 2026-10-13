import type { CharacterStat } from '@spec/core'

interface Props {
  stats: CharacterStat[]
  /** heading lookup for the per-character scene list */
  sceneHeadings: Map<string, string>
  filteredCharacter: string | null
  onFilter(name: string | null): void
  onJumpToScene(sceneId: string): void
  selected: string | null
  onSelect(name: string | null): void
}

/**
 * The Characters tab of the sidebar: who speaks, how much, and where.
 * "Filter" dims every scene the character is not in; selecting a character
 * lists their scenes for jumping.
 */
export function CharacterNavigator({
  stats,
  sceneHeadings,
  filteredCharacter,
  onFilter,
  onJumpToScene,
  selected,
  onSelect
}: Props): React.JSX.Element {
  return (
    <div className="char-nav">
      {stats.length === 0 && <p className="empty">No dialogue yet.</p>}
      {filteredCharacter && (
        <button className="char-clear-filter" onClick={() => onFilter(null)}>
          Showing scenes with {filteredCharacter} — clear
        </button>
      )}
      <ol>
        {stats.map((stat) => (
          <li key={stat.name} className={selected === stat.name ? 'open' : ''}>
            <button
              className="char-row"
              onClick={() => onSelect(selected === stat.name ? null : stat.name)}
              title={`${stat.cues} speeches in ${stat.scenes} scene${stat.scenes === 1 ? '' : 's'}`}
            >
              <span className="char-name">{stat.name}</span>
              <span className="char-counts">
                {stat.cues} · {stat.scenes} sc
              </span>
            </button>
            {selected === stat.name && (
              <div className="char-detail">
                <button
                  className={`char-filter${filteredCharacter === stat.name ? ' active' : ''}`}
                  onClick={() => onFilter(filteredCharacter === stat.name ? null : stat.name)}
                >
                  {filteredCharacter === stat.name ? 'Unfilter script' : 'Filter script to their scenes'}
                </button>
                <ol className="char-scenes">
                  {stat.sceneIds.map((id) => (
                    <li key={id}>
                      <button onClick={() => onJumpToScene(id)}>
                        {sceneHeadings.get(id) ?? '(scene)'}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
