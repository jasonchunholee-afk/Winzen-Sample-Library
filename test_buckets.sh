buckets=(
  "gen-lang-client-0864948280.firebasestorage.app"
  "gen-lang-client-0864948280.appspot.com"
  "gen-lang-client-0864948280"
  "b2ivovcmpw46tkdnrw3tw7"
)

for b in "${buckets[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://storage.googleapis.com/$b")
  echo "Bucket $b: HTTP $code"
done
