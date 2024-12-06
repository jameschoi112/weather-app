'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, MapPin, Loader, Umbrella } from 'lucide-react';
import OpenAI from 'openai';

interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  hourly: HourlyForecast[];
  precipitation: number;
  daily: DailyForecast[];
}

interface HourlyForecast {
  time: string;
  temp: number;
  icon: string;
  precipitation: number;
}

interface DailyForecast {
  date: string;
  day: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
  am_icon: string;
  pm_icon: string;
}

interface WeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  wind: {
    speed: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  name: string;
}

interface OneCallResponse {
  current: {
    dt: number;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    weather: Array<{
      icon: string;
    }>;
    pop: number;
  }>;
  daily: Array<{
    dt: number;
    temp: {
      min: number;
      max: number;
    };
    weather: Array<{
      description: string;
      icon: string;
    }>;
  }>;
}

const getBackgroundImage = (weatherCode: string): string => {
  const hour = new Date().getHours();
  let timeOfDay = 'day';

  if (hour >= 21 || hour < 6) {
    timeOfDay = 'night';
  } else if (hour >= 18) {
    timeOfDay = 'evening';
  }

  let weather = 'clear';
  if (weatherCode.includes('01')) {
    weather = 'clear';
  } else if (weatherCode.includes('02') || weatherCode.includes('03') || weatherCode.includes('04')) {
    weather = 'cloudy';
  } else if (weatherCode.includes('09') || weatherCode.includes('10')) {
    weather = 'rain';
  } else if (weatherCode.includes('11')) {
    weather = 'thunder';
  } else if (weatherCode.includes('13')) {
    weather = 'snow';
  }

  return `/backgrounds/${timeOfDay}/${weather}.jpg`;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const day = days[date.getDay()];
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  return {
    day,
    date: `${month}/${dayOfMonth}`
  };
};

const WeatherApp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState('수원시');

  const getWeatherIcon = (weatherCode: string): JSX.Element => {
    const iconMap: { [key: string]: JSX.Element } = {
      '01d': <Sun className="w-8 h-8 text-yellow-400" />,
      '01n': <Sun className="w-8 h-8 text-gray-300" />,
      '02d': <Cloud className="w-8 h-8 text-gray-200" />,
      '02n': <Cloud className="w-8 h-8 text-gray-300" />,
      '03d': <Cloud className="w-8 h-8 text-gray-400" />,
      '03n': <Cloud className="w-8 h-8 text-gray-400" />,
      '04d': <Cloud className="w-8 h-8 text-gray-500" />,
      '04n': <Cloud className="w-8 h-8 text-gray-500" />,
      '09d': <CloudRain className="w-8 h-8 text-blue-400" />,
      '09n': <CloudRain className="w-8 h-8 text-blue-400" />,
      '10d': <CloudRain className="w-8 h-8 text-blue-500" />,
      '10n': <CloudRain className="w-8 h-8 text-blue-500" />,
      '11d': <CloudLightning className="w-8 h-8 text-yellow-500" />,
      '11n': <CloudLightning className="w-8 h-8 text-yellow-500" />,
      '13d': <CloudSnow className="w-8 h-8 text-blue-200" />,
      '13n': <CloudSnow className="w-8 h-8 text-blue-200" />
    };

    return iconMap[weatherCode] || <Cloud className="w-8 h-8 text-gray-400" />;
  };

  const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData | null> => {
    const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!API_KEY) {
      console.error('OpenWeather API key not found');
      return null;
    }

    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&lang=kr&appid=${API_KEY}`;

    const getWeatherDescription = (description: string): string => {
      const descriptionMap: { [key: string]: string } = {
        '온흐림': '흐림',
        '박무': '흐림',
        '튼구름': '구름 많음',
        '엷은 구름': '구름 조금'
      };
      return descriptionMap[description] || description;
    };

    try {
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${API_KEY}`;
      const [oneCallResponse, currentWeatherResponse] = await Promise.all([
        fetch(url),
        fetch(currentWeatherUrl)
      ]);

      const oneCallData = (await oneCallResponse.json()) as OneCallResponse;
      const currentWeather = (await currentWeatherResponse.json()) as WeatherResponse;

      const locationName = currentWeather.name || '알 수 없는 위치';
      setLocation(locationName);

      const weatherData: WeatherData = {
        temp: Math.round(currentWeather.main.temp),
        feels_like: Math.round(currentWeather.main.feels_like),
        humidity: currentWeather.main.humidity,
        wind_speed: currentWeather.wind.speed,
        description: getWeatherDescription(currentWeather.weather[0].description),
        icon: currentWeather.weather[0].icon,
        precipitation: Math.round((oneCallData.hourly?.[0]?.pop || 0) * 100),
        hourly: oneCallData.hourly?.slice(0, 6).map(hour => ({
          time: hour.dt === oneCallData.current.dt ? '지금' :
                new Date(hour.dt * 1000).getHours() + ':00',
          temp: Math.round(hour.temp),
          icon: hour.weather[0].icon,
          precipitation: Math.round(hour.pop * 100)
        })) || [],
        daily: oneCallData.daily.slice(0, 7).map(day => ({
          date: formatDate(day.dt).date,
          day: formatDate(day.dt).day,
          temp_min: Math.round(day.temp.min),
          temp_max: Math.round(day.temp.max),
          description: getWeatherDescription(day.weather[0].description),
          icon: day.weather[0].icon,
          am_icon: day.weather[0].icon,
          pm_icon: day.weather[0].icon
        }))
      };

      return weatherData;
    } catch (error) {
      console.error('날씨 데이터 가져오기 실패:', error);
      return null;
    }
  };

  const AIRecommendation: React.FC = () => {
    const [recommendation, setRecommendation] = useState<{
      clothing: string;
      umbrella: string;
    } | null>(null);

    useEffect(() => {
      const getRecommendation = async () => {
        if (!weatherData) return;

        const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
          console.error('OpenAI API key not found');
          return;
        }

        const openai = new OpenAI({
          apiKey: OPENAI_API_KEY,
          dangerouslyAllowBrowser: true
        });

        try {
          const hourlyPrecipitation = weatherData.hourly
            .map(hour => `${hour.time}: ${hour.precipitation}%`)
            .join('\n      ');

          const isCurrentlyRaining = weatherData.icon.includes('09') ||
                                   weatherData.icon.includes('10') ||
                                   weatherData.icon.includes('13');

          const prompt = `현재 날씨 정보:
          - 기온: ${weatherData.temp}도
          - 현재 날씨: ${weatherData.description}
          - 현재 강수 여부: ${isCurrentlyRaining ? '비/눈이 오는 중' : '강수 없음'}
          - 시간대별 강수확률:
              ${hourlyPrecipitation}

          위 날씨에 맞는 옷차림과 우산 필요 여부를 알려주세요.
          첫 줄에는 현재 기온과 날씨에 맞는 옷차림을 추천해주세요.
          두 번째 줄에는 현재 날씨와 시간대별 강수확률을 모두 고려하여 우산 필요 여부를 알려주세요.`;

          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 200
          });

          const aiResponse = response.choices[0].message.content || '';
          const responseLines = aiResponse.split('\n').filter(line => line.trim().length > 0);

          setRecommendation({
            clothing: responseLines[0] || '옷차림 추천을 불러오는 중입니다...',
            umbrella: responseLines[1] || '우산 필요 여부를 확인하는 중입니다...'
          });
        } catch (error) {
          console.error('AI 추천 오류:', error);
          setRecommendation({
            clothing: '현재 옷차림 추천을 불러올 수 없습니다.',
            umbrella: '현재 우산 필요 여부를 확인할 수 없습니다.'
          });
        }
      };

      getRecommendation();
    }, [weatherData]);

    if (!recommendation) return null;

    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-lg animate-slide-up">
        <h2 className="text-xl font-bold mb-4">날씨 도우미</h2>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="bg-white/30 rounded-full p-2">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <div className="font-medium mb-1">오늘의 옷차림 추천</div>
              <div className="text-sm opacity-90">{recommendation.clothing}</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="bg-white/30 rounded-full p-2">
              <Umbrella className="w-6 h-6" />
            </div>
            <div>
              <div className="font-medium mb-1">우산 필요 여부</div>
              <div className="text-sm opacity-90">{recommendation.umbrella}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WeeklyForecast: React.FC<{ daily: DailyForecast[] }> = ({ daily }) => {
    const today = daily[0];
    const tomorrow = daily[1];
    const remainingDays = daily.slice(2);

    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">주간 날씨</h2>

        <div className="bg-white/10 rounded-2xl p-4 mb-4">
          <div className="text-lg font-bold mb-2">오늘</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-center">
                <span className="text-sm">오전</span>
                {getWeatherIcon(today.am_icon)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm">오후</span>
                {getWeatherIcon(today.pm_icon)}
              </div>
            </div>
            <div className="text-center">
              <div>{today.description}</div>
              <div className="flex space-x-2 justify-center mt-1">
                <span className="text-blue-200">{today.temp_min}°</span>
                <span>{today.temp_max}°</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 mb-4">
          <div className="text-lg font-bold mb-2">내일</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col items-center">
                <span className="text-sm">오전</span>
                {getWeatherIcon(tomorrow.am_icon)}
              </div>
              <div className="flex flex-col items-center">
              <span className="text-sm">오후</span>
                {getWeatherIcon(tomorrow.pm_icon)}
              </div>
            </div>
            <div className="text-center">
              <div>{tomorrow.description}</div>
              <div className="flex space-x-2 justify-center mt-1">
                <span className="text-blue-200">{tomorrow.temp_min}°</span>
                <span>{tomorrow.temp_max}°</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {remainingDays.map((day, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <div className="w-16">
                <div className="font-bold">{day.day}</div>
                <div className="text-sm opacity-80">{day.date}</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex flex-col items-center">
                  <span className="text-xs">오전</span>
                  {getWeatherIcon(day.am_icon)}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs">오후</span>
                  {getWeatherIcon(day.pm_icon)}
                </div>
              </div>
              <div className="flex space-x-2">
                <span className="text-blue-200">{day.temp_min}°</span>
                <span>{day.temp_max}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  useEffect(() => {
    const getLocation = async () => {
      setLoading(true);
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const data = await fetchWeatherData(
                  position.coords.latitude,
                  position.coords.longitude
                );
                if (data) {
                  setWeatherData(data);
                }
              } catch (error) {
                console.error(error);
                const fallbackData = await fetchWeatherData(37.2911, 127.0089);
                if (fallbackData) {
                  setWeatherData(fallbackData);
                }
              } finally {
                setLoading(false);
              }
            },
            async (error) => {
              console.error('위치 정보를 가져올 수 없습니다:', error);
              const fallbackData = await fetchWeatherData(37.2911, 127.0089);
              if (fallbackData) {
                setWeatherData(fallbackData);
              }
              setLoading(false);
            }
          );
        } else {
          setError('위치 정보를 지원하지 않는 브라우저입니다.');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in getLocation:', error);
        setError('날씨 정보를 가져오는데 실패했습니다.');
        setLoading(false);
      }
    };

    getLocation();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center">
        <Loader className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl">{error}</p>
        </div>
      </div>
    );
  }

  if (!weatherData) return null;

  return (
    <div
      className="min-h-screen p-4 text-white bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${getBackgroundImage(weatherData.icon)})`,
        backgroundColor: 'rgba(0,0,0,0.3)',
        backgroundBlend: 'overlay'
      }}
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-center mb-8 animate-fade-in">
          <MapPin className="w-6 h-6 mr-2" />
          <h1 className="text-2xl font-bold">{location}</h1>
        </div>

        <div className="bg-white/20 rounded-3xl p-8 mb-6 shadow-lg animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-7xl font-bold mb-2 flex items-start">
                {weatherData.temp}
                <span className="text-4xl mt-1">°C</span>
              </div>
              <div className="text-xl mb-1">{weatherData.description}</div>
              <div className="text-sm opacity-80 flex items-center">
                <span>체감온도: {weatherData.feels_like}°</span>
                <div className="w-1 h-1 bg-white rounded-full mx-2 opacity-50"></div>
                <span>{location}</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-full p-4 backdrop-blur-lg animate-bounce-slow">
              {getWeatherIcon(weatherData.icon)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 animate-slide-up">
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4">
            <div className="flex items-center mb-2">
              <Wind className="w-5 h-5 mr-2" />
              <span>바람</span>
            </div>
            <div className="text-2xl font-bold">{weatherData.wind_speed} m/s</div>
          </div>
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4">
            <div className="flex items-center mb-2">
              <CloudRain className="w-5 h-5 mr-2" />
              <span>습도</span>
            </div>
            <div className="text-2xl font-bold">{weatherData.humidity}%</div>
          </div>
        </div>

        <AIRecommendation />

        <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">시간별 날씨</h2>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex space-x-6 min-w-max">
              {weatherData.hourly.map((hour, index) => (
                <div key={index} className="flex flex-col items-center min-w-[60px]">
                  <span className="text-sm mb-2">{hour.time}</span>
                  {getWeatherIcon(hour.icon)}
                  <span className="text-lg font-bold mt-2">{hour.temp}°</span>
                  <span className="text-sm opacity-80">{hour.precipitation}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <WeeklyForecast daily={weatherData.daily} />
      </div>
    </div>
  );
};

export default WeatherApp;