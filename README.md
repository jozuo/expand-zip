# expand-zip
AWS S3にアップロードされたZipファイルを展開する

## 処理概要

処理概要は以下の通り

- zip形式のファイルがS3のアップロード用バケットにアップロードされる
- そのイベントをトリガーにLambda Functionが実行され
- S3の展開先バケットの既存ファイルを削除し
- zipファイルを S3の展開先バケットに展開する


## ローカルでの動作確認方法

[LocalStack](https://github.com/localstack/localstack)と[aws-sam-local](https://github.com/awslabs/aws-sam-local)を利用して
ローカル環境での動作確認を行うための手順は以下の通り。


### 環境準備
#### aws-sam-localのインストール

```
$ npm install -g aws-sam-local
```


#### LocalStackの起動

```
$ git clone https://github.com/localstack/localstack.git
$ docker-compose up -d
```

### 事前作業
#### S3用のイベントファイル作成

S3に対するアクションで発生するイベントファイルを aws-sam-local にて作成する。  
今回は以下のパラメータを指定して作成する。

- --bucket : イベントのトリガーなるバケット
- --key : イベントのトリガーなるオブジェクトキー(アップロードされるzipファイル名)

```
$ sam local generate-event s3 --bucket upload.jozuo.work --key dist.zip > s3-event.json

```

#### LocalStackのS3にバケット作成

動作に必要となる以下2つのS3バケットをLocalStackに作成する。  

- アップロード用バケット : upload.jozuo.work
- 展開先バケット : dest.jozuo.work

```
$ alias aws='aws --endpoint-url=http://localhost:4572' 	
$ aws s3 mb s3://upload.jozuo.work
$ aws s3 mb s3://dest.jozuo.work
```


※ ポイント

- LocalStackで S3は`http://localhost:4572`でアクセスできる
- `aws-cli`でLocalStackにアクセスするには、上記URLを`--endpoint-url`パラメータで指定する

バケットができたことの確認

```
$ aws s3 ls

	2006-02-04 01:45:09 upload.jozuo.work
	2006-02-04 01:45:09 dest.jozuo.work
```

#### アップロード用バケットにzipファイルを配置

動作確認はLambda Functionを起動するところからになるため、事前にzipファイルがアップロードされた状態を作って置く必要がある。
(事前に `dist.zip`という名前で 複数ファイルを圧縮したzipファイルも作成しておく)

```
$ aws s3 cp ./dist.zip s3://upload.jozuo.work
```

アップロードできたことの確認

```
$ aws s3 ls --recursive s3://upload.jozuo.work 

	2018-03-10 12:29:01    3426022 dist.zip
```

### 実行

#### Lambda Functionの起動

以下の環境変数を指定後、aws-sam-localを利用して対象のLambda Functionを起動する。

- NODE_ENV: 'local'を指定して S3へのアクセスをLocalStackに向ける
- DEST_BUCKET: 展開先のバケット名

```
$ export NODE_ENV=local
$ export DEST_BUCKET=dest.jozuo.work
$ NODE_ENV=local sam local invoke --docker-network localstack_default -e s3-event.json
```

※ ポイント

- Docker上で動くLocalStackと通信する必要があるため、`--docker-network`オプションでLocalStackが動作しているDockerネットワークを指定する。
- `yarn run local`で実行可能

展開先のS3バケットに zipファイルが展開されたことを確認する。

```
$ aws s3 ls --recursive s3://dest.jozuo.work

	2018-03-10 12:42:03       4417 3rdpartylicenses.txt
	2018-03-10 12:42:03          0 assets/
	2018-03-10 12:42:03          0 assets/i18n/
	2018-03-10 12:42:03      36931 assets/i18n/locale_en-US.json
	2018-03-10 12:42:03      39653 assets/i18n/locale_fr-CA.json
	2018-03-10 12:42:03      44014 assets/i18n/locale_ja.json
	2018-03-10 12:42:03      36546 assets/i18n/locale_zh-TW.json
	2018-03-10 12:42:03          0 assets/images/
```


### デバッグ

Visual Studio Codeを利用して、Lambda Functionのデバッグが可能

#### デバッグポートを指定してLambda Functionを起動

``` 
$ export NODE_ENV=local
$ export DEST_BUCKET=dest.jozuo.work
$ NODE_ENV=local sam local invoke -d 5858 --docker-network localstack_default -e s3-event.json

	Debugger listening on [::]:5858 … この表示が出るまで待つ
```

※ ポイント

- `yarn run local-debug`で実行可能 

#### VSCodeでデバッグ実行

VSCodeのTypeScriptコードにブレイクポイントを設定後、VSCodeのデバッグ実行を行う


## デプロイ

aws-sam-localを利用して、Lambda FunctionをAWSにデプロイする  

### デプロイ用の専用バケット作成

プログラムファイルアップロード用の専用バケットを作成

```
$ aws s3 mb s3://expandzip.jozuo.work
```

### パッケージングしてデプロイ

```
$ sam package --template-file template.yaml --s3-bucket expandzip.jozuo.work --output-template-file package.yaml
$ sam deploy --template-file ./package.yaml --stack-name expand-zip --capabilities CAPABILITY_IAM
```

※ ポイント

- Lambda Functionは CloudFormation経由で作成されるため、削除する場合はCloudFormationから行う必要がある。
- パッケージング〜デプロイまでの処理は`yarn run deploy`で実行可能


---

## appendix

- バケットのファイルを再帰的に削除するコマンド

```
$ aws s3 rm --recursive <バケット名>
```
---

// 以上





