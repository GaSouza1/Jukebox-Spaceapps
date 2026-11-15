// Install first: npm install axios
import axios, { AxiosError, AxiosInstance } from "axios";
 
// ---- Types ----
interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}
 
type NewPost = Omit<Post, "id">;

const api: AxiosInstance = axios.create({
  baseURL: "https://vercel-nasa-api.vercel.app/api/nasa?coords=-1.2921,36.8219&startDate=2023-01-01&endDate=2023-12-31",
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
    // Authorization: `Bearer ${process.env.API_TOKEN}`,
  },
});
export default api;
// export default async () => await fetch("https://svs.gsfc.nasa.gov/api/40467").then((res) => res.json());