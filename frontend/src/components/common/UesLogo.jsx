export default function UesLogo({ size = 42, className = '' }) {
  return (
    <img
      className={className}
      src="/img/ues-logo.png"
      alt="Logotipo UES - Universidad Estatal de Sonora"
      style={{ width: size, height: 'auto', objectFit: 'contain' }}
    />
  );
}