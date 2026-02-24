import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

// --- KRİTİK GÜNCELLEME: Render adresini buraya yazdık ---
const API_URL = "https://turkish-house-price-prediction.onrender.com";

function App() {
  const [locations, setLocations] = useState({})
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])

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

  // 1. Şehirleri Canlı API'den Getir
  useEffect(() => {
    // Burada API_URL değişkenini kullandık
    axios.get(`${API_URL}/cities`)
      .then(res => {
        setLocations(res.data)
        setCities(Object.keys(res.data))
      })
      .catch(err => {
        console.error("Şehirler yüklenemedi:", err);
        setError("Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.");
      })
  }, [])

  const handleCityChange = (e) => {
    const city = e.target.value
    setSelectedCity(city)
    setDistricts(locations[city] || [])
    setSelectedDistrict('')
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
      // Burada da API_URL değişkenini kullandık
      const response = await axios.post(`${API_URL}/predict`, payload)
      setResult(response.data)
    } catch (err) {
      setError('Hata: Tahmin yapılamadı. Sunucu yanıt vermiyor olabilir.');
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
            <div className="input-group">
              <label>Şehir</label>
              <select value={selectedCity} onChange={handleCityChange} required>
                <option value="">Şehir Seçiniz</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

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