export default function Card({ children, className = '', style }) {
  return (
    <div className={`settings-card${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  )
}

Card.Row = function CardRow({ children, className = '', style }) {
  return (
    <div className={`settings-row${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  )
}
