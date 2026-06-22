import React, { useState } from 'react';

const MOCK_USERS = [
  { username: 'admin', password: 'admin123', name: 'Admin User', role: 'admin', assigned_wards: [] },
  { username: 'planner', password: 'planner123', name: 'City Planner', role: 'planner', assigned_wards: [] },
  { username: 'engineer', password: 'engineer123', name: 'Ward Engineer', role: 'engineer', assigned_wards: ['44', '32', '23', '7', '15'] },
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const found = MOCK_USERS.find(u => u.username === username && u.password === password);
    if (found) {
      onLogin(found);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#EEF2F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '16px',
        padding: '40px', width: '360px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0,0,0,0.06)'
      }}>
        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:'28px'}}>
          <div style={{
            display:'inline-block', background:'#2563EB',
            borderRadius:'10px', padding:'8px 16px',
            fontSize:'14px', fontWeight:700, color:'white',
            marginBottom:'14px'
          }}>ULB</div>
          <div style={{fontSize:'20px', fontWeight:700, color:'#1A2332'}}>AP Smart Utility</div>
          <div style={{fontSize:'20px', fontWeight:700, color:'#2563EB'}}>Demand Forecasting</div>
          <div style={{fontSize:'12px', color:'#8A9AB0', marginTop:'6px'}}>Vijayawada Municipal Corporation</div>
        </div>

        {/* Fields */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'11px', fontWeight:600, color:'#4A5568', marginBottom:'6px'}}>USERNAME</div>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter username"
            style={{
              width:'100%', padding:'10px 12px', borderRadius:'8px',
              border:'1px solid rgba(0,0,0,0.12)', fontSize:'13px',
              color:'#1A2332', background:'#F8FAFC',
              outline:'none', boxSizing:'border-box'
            }}
          />
        </div>
        <div style={{marginBottom:'20px'}}>
          <div style={{fontSize:'11px', fontWeight:600, color:'#4A5568', marginBottom:'6px'}}>PASSWORD</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter password"
            style={{
              width:'100%', padding:'10px 12px', borderRadius:'8px',
              border:'1px solid rgba(0,0,0,0.12)', fontSize:'13px',
              color:'#1A2332', background:'#F8FAFC',
              outline:'none', boxSizing:'border-box'
            }}
          />
        </div>

        {error && <div style={{fontSize:'12px', color:'#DC2626', marginBottom:'14px', textAlign:'center'}}>{error}</div>}

        <button
          onClick={handleSubmit}
          style={{
            width:'100%', padding:'11px', borderRadius:'8px',
            background:'#2563EB', color:'white', border:'none',
            fontSize:'13px', fontWeight:600, cursor:'pointer'
          }}
        >Sign In</button>

        {/* Demo credentials hint */}
        <div style={{marginTop:'20px', padding:'12px', background:'#F0F4F8', borderRadius:'8px'}}>
          <div style={{fontSize:'10px', fontWeight:700, color:'#8A9AB0', marginBottom:'6px'}}>DEMO CREDENTIALS</div>
          {[
            {role:'Admin', user:'admin', pass:'admin123'},
            {role:'Planner', user:'planner', pass:'planner123'},
            {role:'Engineer', user:'engineer', pass:'engineer123'},
          ].map(c => (
            <div key={c.role} style={{fontSize:'11px', color:'#4A5568', marginBottom:'3px'}}>
              <span style={{fontWeight:600, color:'#2563EB'}}>{c.role}:</span> {c.user} / {c.pass}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
