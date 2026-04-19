export interface SentimentDataStruct {
    ts: number;
    value: number;
    count: number;
}
export interface SentimentData {
    roomId: string | null;
    data: SentimentDataStruct[];
    loading?: boolean;
    style?: React.CSSProperties;
}
