import { titlePageBlocks, type TitlePageEntry } from '@spec/core'

interface Props {
  titlePage: TitlePageEntry[]
  onEdit(): void
}

/**
 * The title page rendered as "page zero" above the script, laid out from the
 * same blocks the PDF exporter draws, so what you see here is what exports.
 * Clicking it opens the title page editor. With no title page yet, a slim
 * placeholder invites the writer to add one.
 */
export function TitlePagePreview({ titlePage, onEdit }: Props): React.JSX.Element {
  if (titlePage.length === 0) {
    return (
      <button className="title-page-empty" onClick={onEdit}>
        + Add a title page
      </button>
    )
  }

  const { centered, contact, draft } = titlePageBlocks(titlePage)
  return (
    <div
      className="title-page-zero"
      role="button"
      tabIndex={0}
      title="Click to edit the title page"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onEdit()
      }}
    >
      <span className="tp-edit-hint">Edit title page</span>
      <div className="tp-centered">
        {centered.map((line, i) => (
          <div key={i} className="tp-line">
            {line || ' '}
          </div>
        ))}
      </div>
      <div className="tp-bottom">
        <div className="tp-contact">
          {contact.map((line, i) => (
            <div key={i} className="tp-line">
              {line}
            </div>
          ))}
        </div>
        <div className="tp-draft">
          {draft.map((line, i) => (
            <div key={i} className="tp-line">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
