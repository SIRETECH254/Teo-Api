# Google Places API Integration Guide

## Overview

This guide shows how to integrate Google Places API address selection from your React Native frontend with the TEO KICKS backend address system.

## Frontend: Google Places API Response Structure

When a user selects an address using Google Places Autocomplete in React Native, you'll typically receive data like this:

```javascript
// Example Google Places API Response
const googlePlaceResult = {
  place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
  formatted_address: "123 Kimathi Street, Nairobi, Kenya",
  geometry: {
    location: {
      lat: -1.2920659,
      lng: 36.82194619999999
    }
  },
  address_components: [
    {
      long_name: "123",
      short_name: "123",
      types: ["street_number"]
    },
    {
      long_name: "Kimathi Street",
      short_name: "Kimathi St",
      types: ["route"]
    },
    {
      long_name: "Nairobi Central",
      short_name: "Nairobi Central",
      types: ["sublocality_level_1", "sublocality", "political"]
    },
    {
      long_name: "Nairobi",
      short_name: "Nairobi",
      types: ["locality", "political"]
    },
    {
      long_name: "Nairobi County",
      short_name: "Nairobi County",
      types: ["administrative_area_level_1", "political"]
    },
    {
      long_name: "Kenya",
      short_name: "KE",
      types: ["country", "political"]
    },
    {
      long_name: "00100",
      short_name: "00100",
      types: ["postal_code"]
    }
  ]
}
```

## Frontend: Data Transformation for Backend

Transform the Google Places response into the format expected by your backend:

```javascript
// React Native Function to Transform Google Places Data
const transformGooglePlacesToBackend = (googlePlace, userLabel = "Home") => {
  
  // Extract address components
  const getAddressComponent = (types) => {
    const component = googlePlace.address_components?.find(comp => 
      types.some(type => comp.types.includes(type))
    )
    return component?.long_name || ""
  }

  // Extract location details
  const streetNumber = getAddressComponent(["street_number"])
  const route = getAddressComponent(["route"])
  const neighborhood = getAddressComponent(["neighborhood", "sublocality_level_2"])
  const sublocality = getAddressComponent(["sublocality_level_1", "sublocality"])
  const city = getAddressComponent(["locality", "political"])
  const region = getAddressComponent(["administrative_area_level_1", "political"])
  const country = getAddressComponent(["country", "political"])
  const postal = getAddressComponent(["postal_code"])

  // Build street address
  const street = [streetNumber, route].filter(Boolean).join(" ")

  return {
    // Required fields
    label: userLabel,
    
    // Traditional address fields (for backward compatibility)
    street: street || googlePlace.formatted_address,
    city: city,
    region: region,
    country: country || "Kenya",
    postal: postal,
    
    // Google Places specific data
    googlePlaceId: googlePlace.place_id,
    formattedAddress: googlePlace.formatted_address,
    coordinates: {
      latitude: googlePlace.geometry?.location?.lat,
      longitude: googlePlace.geometry?.location?.lng
    },
    locationDetails: {
      neighborhood: neighborhood,
      sublocality: sublocality,
      administrativeArea: region,
      route: route,
      streetNumber: streetNumber
    },
    
    // User preferences
    isDefault: false
  }
}
```

## Frontend: API Call Examples

### Create Address from Google Places

```javascript
// React Native - Create Address
const createAddressFromGooglePlaces = async (googlePlace, label = "Home") => {
  try {
    const addressData = transformGooglePlacesToBackend(googlePlace, label)
    
    const response = await fetch(`${API_BASE_URL}/api/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(addressData)
    })

    const result = await response.json()
    
    if (result.success) {
      console.log('Address created:', result.data.address)
      return result.data.address
    } else {
      throw new Error(result.message || 'Failed to create address')
    }
    
  } catch (error) {
    console.error('Error creating address:', error)
    throw error
  }
}
```

### Update Existing Address

```javascript
// React Native - Update Address
const updateAddressFromGooglePlaces = async (addressId, googlePlace, label) => {
  try {
    const addressData = transformGooglePlacesToBackend(googlePlace, label)
    
    const response = await fetch(`${API_BASE_URL}/api/addresses/${addressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(addressData)
    })

    const result = await response.json()
    
    if (result.success) {
      console.log('Address updated:', result.data.address)
      return result.data.address
    } else {
      throw new Error(result.message || 'Failed to update address')
    }
    
  } catch (error) {
    console.error('Error updating address:', error)
    throw error
  }
}
```

## Backend: API Endpoints

### Create Address
```
POST /api/addresses
Authorization: Bearer {token}
```

### Update Address
```
PUT /api/addresses/:addressId
Authorization: Bearer {token}
```

## Backend: Enhanced Response Format

The backend now returns enhanced address data including Google Places information:

```json
{
  "success": true,
  "data": {
    "address": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "userId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "label": "Home",
      "street": "123 Kimathi Street",
      "city": "Nairobi",
      "region": "Nairobi County",
      "country": "Kenya",
      "postal": "00100",
      "googlePlaceId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "formattedAddress": "123 Kimathi Street, Nairobi, Kenya",
      "coordinates": {
        "latitude": -1.2920659,
        "longitude": 36.82194619999999
      },
      "locationDetails": {
        "neighborhood": "City Center",
        "sublocality": "Nairobi Central",
        "administrativeArea": "Nairobi County",
        "route": "Kimathi Street",
        "streetNumber": "123"
      },
      "isDefault": false,
      "isActive": true,
      "fullAddress": "123 Kimathi Street, Nairobi, Nairobi County, 00100",
      "createdAt": "2023-09-06T10:30:00.000Z",
      "updatedAt": "2023-09-06T10:30:00.000Z"
    }
  }
}
```

## React Native: Google Places Autocomplete Implementation

Here's a basic implementation using `react-native-google-places-autocomplete`:

```javascript
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const AddressSelector = ({ onAddressSelected }) => {
  return (
    <GooglePlacesAutocomplete
      placeholder='Search for an address...'
      onPress={(data, details = null) => {
        if (details) {
          // Transform and use the address
          const transformedAddress = transformGooglePlacesToBackend(details)
          onAddressSelected(transformedAddress)
        }
      }}
      query={{
        key: GOOGLE_PLACES_API_KEY,
        language: 'en',
        components: 'country:ke', // Restrict to Kenya
        location: '-1.2921,36.8219', // Nairobi coordinates
        radius: 50000, // 50km radius
      }}
      requestUrl={{
        useOnPlatform: 'web',
        url: 'https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api'
      }}
      fetchDetails={true}
      enablePoweredByContainer={false}
      styles={{
        textInput: {
          height: 50,
          borderWidth: 1,
          borderColor: '#E5E5E5',
          borderRadius: 8,
          paddingHorizontal: 15,
          fontSize: 16,
        },
        listView: {
          backgroundColor: 'white',
          borderRadius: 8,
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }
      }}
    />
  )
}
```

## Key Benefits

1. **🎯 Accurate Addresses**: Google Places ensures valid, deliverable addresses
2. **📍 Geolocation**: Coordinates enable distance calculations and map integration
3. **🔍 Rich Details**: Additional location context for better delivery optimization
4. **🇰🇪 Kenya Focus**: Optimized for Kenyan addresses and locations
5. **🔄 Flexible Storage**: Supports both manual entry and Google Places data
6. **📊 Analytics**: Place IDs enable address usage analytics

## Error Handling

```javascript
// Handle Google Places API errors
const handleGooglePlacesError = (error) => {
  console.error('Google Places Error:', error)
  
  switch (error.code) {
    case 'OVER_QUERY_LIMIT':
      alert('Too many requests. Please try again later.')
      break
    case 'REQUEST_DENIED':
      alert('Google Places access denied. Check API key.')
      break
    case 'INVALID_REQUEST':
      alert('Invalid location request.')
      break
    default:
      alert('Unable to find address. Please try manual entry.')
  }
}
```

## Manual Address Entry Fallback

Always provide a manual address entry option for cases where Google Places fails:

```javascript
const manualAddressData = {
  label: "Home",
  street: "123 Manual Street",
  city: "Nairobi",
  region: "Nairobi County", 
  country: "Kenya",
  postal: "00100",
  isDefault: false
  // Note: No Google Places specific fields
}
```

This ensures your app works even when Google Places API is unavailable or users prefer manual entry.