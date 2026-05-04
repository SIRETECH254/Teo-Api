import { Client } from "@googlemaps/google-maps-services-js";
import { errorHandler } from "../utils/error.js";

const client = new Client({});

export const searchLocation = async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(errorHandler(400, "Query parameter is required"));
  }

  try {
    const response = await client.textSearch({
      params: {
        query: query,
        key: process.env.GOOGLE_PLACE_API || 'YOUR_API_KEY_HERE',
      },
      timeout: 1000,
    });

    res.status(200).json(response.data.results);
  } catch (error) {
    console.error(error.response?.data || error.message);
    next(errorHandler(500, "Failed to fetch location data"));
  }
};
