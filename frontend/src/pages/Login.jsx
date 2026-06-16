import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [telefone, setTelefone] = useState('');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const { data } = await api.post('/auth/login', { telefone: telefone.replace(/\D/g, ''), pin });
      localStorage.setItem('token', data.token);
      if (data.primeiroAcesso) {
        const novoPIN = prompt('Primeiro acesso: escolha um novo PIN de 4 a 6 dígitos:');
        if (novoPIN) {
          await api.post('/auth/trocar-pin', { pinAtual: pin, pinNovo: novoPIN });
        }
      }
      navigate('/');
    } catch (err) {
      setErro(err.response?.data?.erro ?? 'Erro ao fazer login.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg)',
    }}>
      {/* Painel esquerdo — laranja */}
      <div style={{
        flex: '0 0 420px',
        background: 'linear-gradient(145deg, #e13613 0%, #df6011 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        gap: 24,
      }}>
        <Logo height={120} style={{ color: '#ffffff', filter: 'brightness(0) invert(1)' }} />
        <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, textAlign: 'center', lineHeight: 1.7 }}>
          Sistema de controle de gastos<br />integrado ao WhatsApp
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <form
          onSubmit={handleSubmit}
          style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Entrar</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Acesse o painel de controle
            </p>
          </div>

          <div>
            <label>Telefone (com DDD)</label>
            <input
              type="tel"
              placeholder="55 11 9 9999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          </div>

          <div>
            <label>PIN</label>
            <input
              type="password"
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p style={{
              color: 'var(--danger)', fontSize: 13,
              background: '#fff4f4', border: '1px solid #fcc', borderRadius: 6, padding: '8px 12px',
            }}>{erro}</p>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={carregando}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
