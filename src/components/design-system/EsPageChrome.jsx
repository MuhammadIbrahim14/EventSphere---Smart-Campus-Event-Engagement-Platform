export default function EsPageChrome({ eyebrow, title, description, action, className = '' }) {
  return (
    <div className={`es-page-head page-head ${className}`.trim()}>
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action || null}
    </div>
  )
}
