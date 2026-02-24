import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  // Şehir ve İlçe Listesi (Backend'den gelecek)
  const [locations, setLocations] = useState({})
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])

  // Kullanıcı Seçimleri
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [formData, setFormData] = useState({
    metrekare: '',
    oda_sayisi: '',
    salon_sayisi: ''
  })

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1. Uygulama açılınca Şehirleri Getir
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/cities')
      .then(res => {
        setLocations(res.data)
        setCities(Object.keys(res.data)) // Sadece şehir isimlerini al
      })
      .catch(err => console.error("Şehirler yüklenemedi:", err))
  }, [])

  // 2. Şehir Seçilince İlçeleri Güncelle
  const handleCityChange = (e) => {
    const city = e.target.value
    setSelectedCity(city)
    setDistricts(locations[city] || []) // O şehrin ilçelerini al
    setSelectedDistrict('') // Eski ilçe seçimini sıfırla
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    if (!selectedCity || !selectedDistrict) {
      setError('Lütfen İl ve İlçe seçiniz.')
      setLoading(false)
      return
    }

    const payload = {
      il: selectedCity,
      ilce: selectedDistrict,
      metrekare: parseFloat(formData.metrekare),
      oda_sayisi: parseFloat(formData.oda_sayisi),
      salon_sayisi: parseFloat(formData.salon_sayisi)
    }

    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', payload)
      setResult(response.data)
    } catch (err) {
      setError('Hata: Sunucuya bağlanılamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1>🏡 Akıllı Emlakçı</h1>
        <p>Hayalinizdeki evin değerini öğrenin</p>

        <form onSubmit={handleSubmit}>
          <div className="grid">
            
            {/* Şehir Seçimi */}
            <div className="input-group">
              <label>Şehir</label>
              <select value={selectedCity} onChange={handleCityChange} required>
                <option value="">Şehir Seçiniz</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* İlçe Seçimi (Şehir seçilince aktif olur) */}
            <div className="input-group">
              <label>İlçe</label>
              <select 
                value={selectedDistrict} 
                onChange={(e) => setSelectedDistrict(e.target.value)} 
                disabled={!selectedCity}
                required
              >
                <option value="">
                  {selectedCity ? 'İlçe Seçiniz' : 'Önce Şehir Seçin'}
                </option>
                {districts.map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label>Metrekare (m²)</label>
              <input type="number" name="metrekare" placeholder="100" required onChange={handleChange} />
            </div>

            <div className="input-group">
              <label>Oda Sayısı</label>
              <input type="number" name="oda_sayisi" placeholder="3" required onChange={handleChange} />
            </div>

            <div className="input-group">
              <label>Salon Sayısı</label>
              <input type="number" name="salon_sayisi" placeholder="1" required onChange={handleChange} />
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Hesaplanıyor...' : 'Fiyatı Gör'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {result && (
          <div className="result-box">
            <h3>Tahmini Değer</h3>
            <div className="price">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(result.tahmin_fiyat)}
            </div>
            <small>{result.konum}</small>
          </div>
        )}
      </div>
    </div>
  )
}

export default App