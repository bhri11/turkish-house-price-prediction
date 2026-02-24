from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Real Estate API")

# CORS (Frontend erişimi için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modeli ve Veriyi Yükle
current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, "final_real_estate_model_v1.pkl")

# Şehir ve İlçe haritasını hafızada tutacağız
city_district_map = {}

try:
    artifacts = joblib.load(model_path)
    model = artifacts["model"]
    ilce_map = artifacts["ilce_map"]
    global_avg = artifacts["global_avg"]
    train_columns = artifacts["columns"]
    
    # --- YENİ EKLENEN KISIM: Şehir-İlçe Haritasını Oluşturma ---
    # Model eğitilirken kullanılan CSV'den değil, ilçe haritasından (ilce_map) yola çıkacağız.
    # Ancak ilçe_map sadece ilçe isimlerini içeriyor, şehir bilgisini içermiyor.
    # Bu yüzden manuel bir harita veya eğer artifacts içinde sakladıysak onu kullanmalıyız.
    # Şimdilik en güvenli yol: Frontend'e statik bir liste göndermek yerine
    # veya eğer processed_csv yanındaysa onu okumak.
    # Basitlik adına: Python tarafında dinamik okuma yapalım.
    
    csv_path = os.path.join(current_dir, "..", "processed_turkish_house_sales.csv")
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        # Şehir -> İlçe listesi (Alfabetik Sıralı)
        city_district_map = df.groupby('il')['Ilce'].unique().apply(lambda x: sorted(list(x))).to_dict()
    else:
        print("UYARI: CSV dosyası bulunamadı, şehir listesi boş kalacak!")

    print("--- Model ve Veri Başarıyla Yüklendi ---")
except Exception as e:
    print(f"HATA: Model yüklenemedi! {e}")
    model = None

# Giriş Verisi Şablonu (Satıcı Tipi ARTIK YOK)
class HouseFeatures(BaseModel):
    il: str
    ilce: str
    metrekare: float
    oda_sayisi: float
    salon_sayisi: float

# --- YENİ ENDPOINT: Şehir ve İlçeleri Getir ---
@app.get("/cities")
def get_cities():
    return city_district_map

# Tahmin Endpoint'i
@app.post("/predict")
def predict_price(features: HouseFeatures):
    if model is None:
        raise HTTPException(status_code=500, detail="Model yok.")

    try:
        # 1. Gelen veriyi hazırla
        input_data = {
            'Metrekare': [features.metrekare],
            'Room_Count': [features.oda_sayisi],
            'Living_Room_Count': [features.salon_sayisi]
        }
        
        df_input = pd.DataFrame(input_data)
        
        # 2. Target Encoding (İlçe Skoru)
        ilce_skoru = ilce_map.get(features.ilce, global_avg)
        df_input['Ilce_Encoded'] = ilce_skoru

        # 3. One-Hot Encoding (Eksik sütunları tamamla)
        for col in train_columns:
            if col not in df_input.columns:
                df_input[col] = 0
        
        # Seçilen İl'i işaretle
        il_col = f"il_{features.il}"
        if il_col in df_input.columns:
            df_input[il_col] = 1
            
        # --- GİZLİ HAMLE: Satıcı Tipi ---
        # Kullanıcıya sormuyoruz ama model beklediği için 'Sahibinden' varmış gibi davranıyoruz.
        satici_col = "satici_tip_Sahibinden"
        if satici_col in df_input.columns:
            df_input[satici_col] = 1
            
        # Sütun sırasını eşitle
        df_input = df_input[train_columns]

        # 4. Tahmin
        log_pred = model.predict(df_input)[0]
        real_price = np.expm1(log_pred)

        return {
            "tahmin_fiyat": round(real_price, 2),
            "konum": f"{features.il} / {features.ilce}"
        }

    except Exception as e:
        return {"error": str(e)}