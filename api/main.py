from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Turkish House Price API 2025")

# CORS - Frontend (Vercel vb.) erişimi için
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dosya Yollarını Belirle ---
current_dir = os.path.dirname(os.path.abspath(__file__))
# Yeni sıkıştırılmış model ismini buraya tanımladık
model_path = os.path.join(current_dir, "final_real_estate_model_compressed.pkl")
# Veri seti yolu (Render'a bu dosyayı da yüklediğinden emin olmalısın)
csv_path = os.path.join(current_dir, "..", "processed_turkish_house_sales.csv")

# Değişkenleri global tanımlıyoruz
model = None
ilce_map = None
global_avg = None
train_columns = None
city_district_map = {}

# --- Modeli ve Veriyi Yükle ---
try:
    if os.path.exists(model_path):
        artifacts = joblib.load(model_path)
        model = artifacts["model"]
        ilce_map = artifacts["ilce_map"]
        global_avg = artifacts["global_avg"]
        train_columns = artifacts["columns"]
        print("--- Sıkıştırılmış Model Başarıyla Yüklendi ---")
    else:
        print(f"HATA: Model dosyası bulunamadı: {model_path}")

    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        # Şehir -> İlçe listesi (Alfabetik Sıralı)
        city_district_map = df.groupby('il')['Ilce'].unique().apply(lambda x: sorted(list(x))).to_dict()
        print("--- Şehir-İlçe Haritası Hazırlandı ---")
    else:
        print(f"UYARI: {csv_path} bulunamadı, dinamik şehir listesi çalışmayacak.")

except Exception as e:
    print(f"Kritik Yükleme Hatası: {e}")

# Giriş Verisi Şablonu
class HouseFeatures(BaseModel):
    il: str
    ilce: str
    metrekare: float
    oda_sayisi: float
    salon_sayisi: float

@app.get("/")
def read_root():
    return {"status": "API is running", "model_loaded": model is not None}

@app.get("/cities")
def get_cities():
    if not city_district_map:
        raise HTTPException(status_code=404, detail="Şehir verisi yüklenemedi.")
    return city_district_map

@app.post("/predict")
def predict_price(features: HouseFeatures):
    if model is None:
        raise HTTPException(status_code=500, detail="Model dosyası sistemde yüklü değil.")

    try:
        # 1. Gelen veriyi DataFrame formatına sok
        input_data = {
            'Metrekare': [features.metrekare],
            'Room_Count': [features.oda_sayisi],
            'Living_Room_Count': [features.salon_sayisi]
        }
        
        df_input = pd.DataFrame(input_data)
        
        # 2. Target Encoding (İlçe Skoru) - Logaritmik modele uygun veri hazırlığı
        ilce_skoru = ilce_map.get(features.ilce, global_avg)
        df_input['Ilce_Encoded'] = ilce_skoru

        # 3. One-Hot Encoding ve Sütun Eşitleme
        for col in train_columns:
            if col not in df_input.columns:
                df_input[col] = 0
        
        # Seçilen İl'i aktif et
        il_col = f"il_{features.il}"
        if il_col in df_input.columns:
            df_input[il_col] = 1
            
        # Satıcı Tipi Hack: Model beklediği için varsayılan değer atıyoruz
        satici_col = "satici_tip_Sahibinden"
        if satici_col in df_input.columns:
            df_input[satici_col] = 1
            
        # Sütun sırasını eğitim verisiyle aynı yap (Random Forest için kritik)
        df_input = df_input[train_columns]

        # 4. Tahmin ve Logaritmik Dönüşümü Geri Alma (exp(x)-1)
        log_pred = model.predict(df_input)[0]
        real_price = np.expm1(log_pred)

        return {
            "tahmin_fiyat": round(float(real_price), 2),
            "konum": f"{features.il} / {features.ilce}",
            "para_birimi": "TL"
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))