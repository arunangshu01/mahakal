import './hud.css'

export default function AccountBadge({ user, guest, onSignIn, onSignOut }) {
  if (user) {
    return (
      <div className="account">
        {user.picture ? (
          <img className="account-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="account-avatar account-initial">{user.name.charAt(0)}</span>
        )}
        <span className="account-name">{user.name.split(' ')[0].toUpperCase()}</span>
        <button type="button" className="account-button" onClick={onSignOut} aria-label={`Sign out ${user.name}`}>
          SIGN OUT
        </button>
      </div>
    )
  }
  if (guest) {
    return (
      <div className="account">
        <span className={`account-guest ${guest.remaining === 0 ? 'empty' : ''}`}>
          GUEST · {guest.remaining}/{guest.limit}
        </span>
        <button type="button" className="account-button primary" onClick={onSignIn}>
          SIGN IN
        </button>
      </div>
    )
  }
  return null
}
