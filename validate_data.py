#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de validation pour les données du portail SIG Boundou
Vérifie la structure et la cohérence des fichiers de données externes
"""

import json
import os
import sys
from pathlib import Path

def validate_geojson(filepath):
    """Valide la structure du fichier GeoJSON"""
    print(f"🗺️  Validation du fichier GeoJSON: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"❌ Fichier non trouvé: {filepath}")
        return False, []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Erreur JSON: {e}")
        return False, []
    except Exception as e:
        print(f"❌ Erreur de lecture: {e}")
        return False, []
    
    # Vérifier la structure GeoJSON
    if data.get('type') != 'FeatureCollection':
        print(f"❌ Type incorrect: attendu 'FeatureCollection', trouvé '{data.get('type')}'")
        return False, []
    
    features = data.get('features', [])
    if not features:
        print("❌ Aucune feature trouvée")
        return False, []
    
    commune_names = []
    for i, feature in enumerate(features):
        properties = feature.get('properties', {})
        
        # Identifier le nom de la commune
        commune_name = properties.get('CCRCA_1') or properties.get('CCRCA') or properties.get('NOM')
        if commune_name:
            commune_names.append(commune_name)
        else:
            print(f"⚠️  Feature {i}: nom de commune non trouvé (champs CCRCA_1, CCRCA, NOM)")
        
        # Vérifier la géométrie
        geometry = feature.get('geometry')
        if not geometry or not geometry.get('coordinates'):
            print(f"⚠️  Feature {i}: géométrie manquante")
    
    print(f"✅ {len(features)} communes trouvées dans le GeoJSON")
    print(f"📋 Communes: {', '.join(sorted(set(commune_names)))}")
    return True, commune_names

def validate_parcelles(filepath):
    """Valide la structure du fichier parcelles.json"""
    print(f"\n📦 Validation du fichier parcelles: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"❌ Fichier non trouvé: {filepath}")
        return False, []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Erreur JSON: {e}")
        return False, []
    except Exception as e:
        print(f"❌ Erreur de lecture: {e}")
        return False, []
    
    # Vérifier que c'est un array
    if not isinstance(data, list):
        print(f"❌ Format incorrect: attendu un array, trouvé {type(data).__name__}")
        return False, []
    
    if not data:
        print("❌ Aucune parcelle trouvée")
        return False, []
    
    # Champs obligatoires
    required_fields = ['id_parcelle', 'commune', 'nicad', 'deliberee', 'type_usag']
    commune_names = []
    stats = {
        'total': len(data),
        'nicad_oui': 0,
        'deliberee_oui': 0,
        'superficie_total': 0,
        'types_usage': {},
        'communes': {}
    }
    
    for i, parcelle in enumerate(data):
        if not isinstance(parcelle, dict):
            print(f"❌ Parcelle {i}: format incorrect, attendu un objet")
            continue
        
        # Vérifier les champs obligatoires
        missing_fields = [field for field in required_fields if field not in parcelle]
        if missing_fields:
            print(f"⚠️  Parcelle {i}: champs manquants: {', '.join(missing_fields)}")
        
        # Récupérer le nom de la commune
        commune = parcelle.get('commune')
        if commune:
            commune_names.append(commune)
            stats['communes'][commune] = stats['communes'].get(commune, 0) + 1
        
        # Statistiques
        if parcelle.get('nicad') == 'Oui':
            stats['nicad_oui'] += 1
        
        if parcelle.get('deliberee') == 'Oui':
            stats['deliberee_oui'] += 1
        
        superficie = parcelle.get('superficie')
        if superficie is not None:
            try:
                stats['superficie_total'] += float(superficie)
            except (ValueError, TypeError):
                pass
        
        type_usage = parcelle.get('type_usag')
        if type_usage:
            stats['types_usage'][type_usage] = stats['types_usage'].get(type_usage, 0) + 1
    
    print(f"✅ {stats['total']} parcelles trouvées")
    print(f"📊 Statistiques:")
    print(f"   • NICAD: {stats['nicad_oui']}/{stats['total']} ({stats['nicad_oui']/stats['total']*100:.1f}%)")
    print(f"   • Délibérées: {stats['deliberee_oui']}/{stats['total']} ({stats['deliberee_oui']/stats['total']*100:.1f}%)")
    print(f"   • Superficie totale: {stats['superficie_total']:.1f} ha")
    print(f"   • Types d'usage: {len(stats['types_usage'])}")
    print(f"   • Communes: {len(stats['communes'])}")
    
    return True, commune_names

def check_commune_consistency(geojson_communes, parcelles_communes):
    """Vérifie la cohérence des noms de communes"""
    print(f"\n🔍 Vérification de la cohérence des communes")
    
    geojson_set = set(geojson_communes)
    parcelles_set = set(parcelles_communes)
    
    # Communes dans GeoJSON mais pas dans parcelles
    missing_in_parcelles = geojson_set - parcelles_set
    if missing_in_parcelles:
        print(f"⚠️  Communes dans GeoJSON mais sans parcelles: {', '.join(sorted(missing_in_parcelles))}")
    
    # Communes dans parcelles mais pas dans GeoJSON
    missing_in_geojson = parcelles_set - geojson_set
    if missing_in_geojson:
        print(f"❌ Communes dans parcelles mais pas dans GeoJSON: {', '.join(sorted(missing_in_geojson))}")
        print("   ⚠️  Ces parcelles ne s'afficheront pas sur la carte!")
    
    # Communes communes
    common = geojson_set & parcelles_set
    if common:
        print(f"✅ Communes avec données complètes: {', '.join(sorted(common))}")
    
    return len(missing_in_geojson) == 0

def validate_project_structure():
    """Vérifie la structure du projet"""
    print(f"\n📁 Vérification de la structure du projet")
    
    required_files = [
        'index.html',
        'app.js', 
        'style.css',
        'data/communes_boundou.geojson',
        'data/parcelles.json'
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
        else:
            print(f"✅ {file_path}")
    
    if missing_files:
        print(f"❌ Fichiers manquants:")
        for file_path in missing_files:
            print(f"   • {file_path}")
        return False
    
    return True

def main():
    """Fonction principale"""
    print("🚀 Validation des données du portail SIG Boundou")
    print("=" * 50)
    
    # Vérifier la structure du projet
    if not validate_project_structure():
        print("\n❌ Structure du projet incorrecte")
        return False
    
    # Valider le GeoJSON
    geojson_valid, geojson_communes = validate_geojson('data/communes_boundou.geojson')
    
    # Valider les parcelles
    parcelles_valid, parcelles_communes = validate_parcelles('data/parcelles.json')
    
    # Vérifier la cohérence
    consistent = True
    if geojson_valid and parcelles_valid:
        consistent = check_commune_consistency(geojson_communes, parcelles_communes)
    
    # Résumé
    print(f"\n📋 Résumé de la validation")
    print("=" * 30)
    print(f"GeoJSON: {'✅ Valide' if geojson_valid else '❌ Erreur'}")
    print(f"Parcelles: {'✅ Valide' if parcelles_valid else '❌ Erreur'}")
    print(f"Cohérence: {'✅ OK' if consistent else '❌ Problème'}")
    
    if geojson_valid and parcelles_valid and consistent:
        print(f"\n🎉 Validation réussie! Le portail peut utiliser vos données.")
        print(f"\nPour lancer le portail:")
        print(f"  python -m http.server 8000")
        print(f"  Puis ouvrez http://localhost:8000")
        return True
    else:
        print(f"\n⚠️  Des problèmes ont été détectés. Veuillez les corriger avant de déployer.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
