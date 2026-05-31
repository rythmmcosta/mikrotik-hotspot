<?php

require_once __DIR__ . '/Config.php';

class ApiClient {
    private static function request(string $method, string $path, array $data = []): array {
        $url = Config::API_BASE . $path;
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => Config::API_TIMEOUT,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_SSL_VERIFYPEER => false,
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($err) {
            return ['error' => $err, 'code' => 0];
        }
        $decoded = json_decode($body, true);
        return array_merge($decoded ?? [], ['_http_code' => $code]);
    }

    public static function post(string $path, array $data = []): array {
        return self::request('POST', $path, $data);
    }

    public static function get(string $path): array {
        return self::request('GET', $path);
    }
}
